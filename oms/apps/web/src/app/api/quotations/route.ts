import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate Quotation number
async function generateQuotationNumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "quotation" },
    update: { currentValue: { increment: 1 } },
    create: { name: "quotation", prefix: "QUO", currentValue: 1, paddingLength: 6 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "QUO"}${paddedNumber}`;
}

// GET /api/quotations - List quotations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const customerId = searchParams.get("customerId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { quotationNo: { contains: search, mode: "insensitive" } },
        { Customer: { name: { contains: search, mode: "insensitive" } } },
        { Customer: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          Customer: {
            select: { id: true, code: true, name: true, email: true },
          },
          _count: {
            select: { QuotationItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.quotation.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      quotations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations" },
      { status: 500 }
    );
  }
}

// POST /api/quotations - Create quotation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId,
      validUntil,
      paymentTermType,
      paymentTermDays,
      notes,
      terms,
      items,
    } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and items are required" },
        { status: 400 }
      );
    }

    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { PriceList: { include: { PriceListItem: true } } },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const processedItems = await Promise.all(
      items.map(async (item: {
        skuId: string;
        quantity: number;
        unitPrice?: number;
        discountPercent?: number;
        taxRate?: number;
      }) => {
        // Get SKU
        const sku = await prisma.sKU.findUnique({ where: { id: item.skuId } });
        if (!sku) throw new Error(`SKU not found: ${item.skuId}`);

        // Get price from price list or use provided price
        let unitPrice = item.unitPrice;
        if (!unitPrice && customer.PriceList) {
          const priceListItem = customer.PriceList.PriceListItem.find(
            (pli) => pli.skuId === item.skuId
          );
          unitPrice = priceListItem ? Number(priceListItem.fixedPrice) : Number(sku.sellingPrice);
        }
        if (!unitPrice) {
          unitPrice = Number(sku.sellingPrice);
        }

        const lineTotal = item.quantity * unitPrice;
        const lineDiscount = lineTotal * ((item.discountPercent || 0) / 100);
        const lineTaxable = lineTotal - lineDiscount;
        const lineTax = lineTaxable * ((item.taxRate || 18) / 100);

        subtotal += lineTotal;
        discountAmount += lineDiscount;
        taxAmount += lineTax;

        return {
          skuId: item.skuId,
          quantity: item.quantity,
          listPrice: unitPrice,
          unitPrice,
          discountPercent: item.discountPercent || 0,
          discountAmount: lineDiscount,
          taxPercent: item.taxRate || 18,
          taxAmount: lineTax,
          totalPrice: lineTaxable + lineTax,
        };
      })
    );

    const totalAmount = subtotal - discountAmount + taxAmount;
    const quotationNo = await generateQuotationNumber();

    // Default validity to 30 days if not provided
    const defaultValidUntil = new Date();
    defaultValidUntil.setDate(defaultValidUntil.getDate() + 30);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        customerId,
        status: "DRAFT",
        validUntil: validUntil ? new Date(validUntil) : defaultValidUntil,
        shippingAddress: customer.billingAddress as object,
        billingAddress: customer.billingAddress as object,
        companyId: customer.companyId,
        locationId: customer.companyId, // Will be updated with actual location
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentTermType: paymentTermType || customer.paymentTermType,
        paymentTermDays: paymentTermDays || customer.paymentTermDays,
        remarks: notes,
        specialTerms: terms,
        createdById: session.user.id,
        QuotationItem: {
          create: processedItems,
        },
      },
      include: {
        Customer: true,
        QuotationItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error("Error creating quotation:", error);
    return NextResponse.json(
      { error: "Failed to create quotation" },
      { status: 500 }
    );
  }
}
