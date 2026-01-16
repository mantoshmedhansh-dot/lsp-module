import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/customers - List B2B customers
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const creditStatus = searchParams.get("creditStatus") || "";
    const customerGroupId = searchParams.get("customerGroupId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (creditStatus) {
      where.creditStatus = creditStatus;
    }

    if (customerGroupId) {
      where.customerGroupId = customerGroupId;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { gst: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          CustomerGroup: {
            select: { id: true, name: true },
          },
          PriceList: {
            select: { id: true, name: true },
          },
          _count: {
            select: { Order: true, Quotation: true, B2BCreditTransaction: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    // Get type counts
    const typeCounts = await prisma.customer.groupBy({
      by: ["type"],
      _count: { _all: true },
    });

    const typeCountMap = typeCounts.reduce(
      (acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get status counts for tabs
    const statusCounts = await prisma.customer.groupBy({
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

    // Get credit summary
    const creditSummary = await prisma.customer.aggregate({
      _sum: {
        creditLimit: true,
        creditUsed: true,
      },
      where: { creditEnabled: true },
    });

    const totalCreditLimit = creditSummary._sum.creditLimit ? Number(creditSummary._sum.creditLimit) : 0;
    const totalCreditUsed = creditSummary._sum.creditUsed ? Number(creditSummary._sum.creditUsed) : 0;

    return NextResponse.json({
      customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      typeCounts: typeCountMap,
      statusCounts: statusCountMap,
      creditSummary: {
        totalCreditLimit,
        totalCreditUsed,
        totalCreditAvailable: totalCreditLimit - totalCreditUsed,
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create B2B customer
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
      code,
      name,
      type = "RETAIL",
      email,
      phone,
      gst,
      pan,
      billingAddress,
      shippingAddress,
      customerGroupId,
      priceListId,
      creditEnabled = false,
      creditLimit = 0,
      paymentTermType = "IMMEDIATE",
      paymentTermDays,
      companyId,
    } = body;

    if (!code || !name || !phone || !companyId) {
      return NextResponse.json(
        { error: "Customer code, name, phone, and companyId are required" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existingCustomer = await prisma.customer.findFirst({
      where: { code },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Customer with this code already exists" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        code,
        name,
        type,
        status: "ACTIVE",
        email,
        phone,
        gst,
        pan,
        billingAddress,
        shippingAddresses: shippingAddress ? [shippingAddress] : [],
        customerGroupId,
        priceListId,
        creditEnabled,
        creditLimit,
        creditUsed: 0,
        creditStatus: "AVAILABLE",
        paymentTermType,
        paymentTermDays,
        companyId,
      },
      include: {
        CustomerGroup: true,
        PriceList: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
