import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/quotations - Get B2B customer quotations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
    });

    if (!customer) {
      return NextResponse.json({ quotations: [], total: 0 });
    }

    const where: Record<string, unknown> = { customerId: customer.id };
    if (status && status !== "all") {
      where.status = status;
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          items: { select: { id: true } },
        },
      }),
      prisma.quotation.count({ where }),
    ]);

    const now = new Date();

    return NextResponse.json({
      quotations: quotations.map((quote) => {
        const daysUntilExpiry = Math.max(
          0,
          Math.ceil((quote.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        return {
          id: quote.id,
          quotationNo: quote.quotationNo,
          status: quote.status,
          totalAmount: Number(quote.totalAmount),
          itemCount: quote.items.length,
          createdAt: quote.createdAt.toISOString().split("T")[0],
          expiresAt: quote.validUntil.toISOString().split("T")[0],
          validDays: daysUntilExpiry,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching B2B quotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/quotations - Request a new quotation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, notes, validityDays = 7 } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Quotation must have at least one item" },
        { status: 400 }
      );
    }

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    // Get default location for the customer's company
    const location = await prisma.location.findFirst({
      where: { companyId: customer.companyId, isActive: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "No active location found" },
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    const quotationItems: Array<{
      skuId: string;
      skuCode: string;
      skuName: string;
      quantity: number;
      listPrice: number;
      unitPrice: number;
      taxPercent: number;
      taxAmount: number;
      totalPrice: number;
    }> = [];

    for (const item of items) {
      const sku = await prisma.sKU.findUnique({
        where: { id: item.skuId },
      });

      if (!sku) {
        return NextResponse.json(
          { error: `SKU not found: ${item.skuId}` },
          { status: 400 }
        );
      }

      const listPrice = Number(sku.mrp || sku.sellingPrice);
      const unitPrice = Number(sku.sellingPrice);
      const itemTaxPercent = Number(sku.taxPercent || 18);
      const lineTotal = unitPrice * item.quantity;
      const lineTax = lineTotal * (itemTaxPercent / 100);

      subtotal += lineTotal;
      taxAmount += lineTax;

      quotationItems.push({
        skuId: item.skuId,
        skuCode: sku.code,
        skuName: sku.name,
        quantity: item.quantity,
        listPrice,
        unitPrice,
        taxPercent: itemTaxPercent,
        taxAmount: lineTax,
        totalPrice: lineTotal + lineTax,
      });
    }

    const totalAmount = subtotal + taxAmount;

    // Generate quotation number
    const quoteCount = await prisma.quotation.count({
      where: { companyId: customer.companyId },
    });
    const quotationNo = `QT-${new Date().getFullYear()}-${String(quoteCount + 1).padStart(4, "0")}`;

    // Create quotation
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    const quotation = await prisma.quotation.create({
      data: {
        companyId: customer.companyId,
        locationId: location.id,
        customerId: customer.id,
        quotationNo,
        status: "PENDING_APPROVAL",
        shippingAddress: customer.shippingAddresses[0] || customer.billingAddress,
        billingAddress: customer.billingAddress,
        subtotal,
        taxAmount,
        totalAmount,
        validUntil,
        remarks: notes,
        createdById: session.user.id || "system",
        items: {
          create: quotationItems.map((item) => ({
            sku: { connect: { id: item.skuId } },
            skuCode: item.skuCode,
            skuName: item.skuName,
            quantity: item.quantity,
            listPrice: item.listPrice,
            unitPrice: item.unitPrice,
            taxPercent: item.taxPercent,
            taxAmount: item.taxAmount,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      message: "Quotation request submitted successfully",
      quotation: {
        id: quotation.id,
        quotationNo: quotation.quotationNo,
        totalAmount: Number(quotation.totalAmount),
        itemCount: quotation.items.length,
        validUntil: quotation.validUntil.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Error creating B2B quotation:", error);
    return NextResponse.json(
      { error: "Failed to create quotation" },
      { status: 500 }
    );
  }
}
