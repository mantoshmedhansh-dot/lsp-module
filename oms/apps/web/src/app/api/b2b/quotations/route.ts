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
          { userId: session.user.id },
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
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          validUntil: true,
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
          quotationNumber: quote.quotationNumber,
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
          { userId: session.user.id },
        ],
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    // Calculate total
    let totalAmount = 0;
    const quotationItems = [];

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

      const unitPrice = Number(sku.sellingPrice);
      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      quotationItems.push({
        skuId: item.skuId,
        quantity: item.quantity,
        unitPrice,
        totalPrice: lineTotal,
      });
    }

    // Generate quotation number
    const quoteCount = await prisma.quotation.count({
      where: { companyId: customer.companyId },
    });
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(quoteCount + 1).padStart(4, "0")}`;

    // Create quotation
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    const quotation = await prisma.quotation.create({
      data: {
        companyId: customer.companyId,
        customerId: customer.id,
        quotationNumber,
        status: "PENDING_APPROVAL",
        totalAmount,
        validUntil,
        notes,
        items: {
          create: quotationItems,
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
        quotationNumber: quotation.quotationNumber,
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
