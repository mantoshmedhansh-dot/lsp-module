import { NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/dashboard - Get B2B customer dashboard data
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({
        summary: {
          totalOrders: 0,
          pendingOrders: 0,
          totalSpent: 0,
          creditAvailable: 0,
        },
        recentOrders: [],
        pendingQuotations: [],
      });
    }

    // Get order counts and totals
    const [orderStats, recentOrders, pendingQuotations] = await Promise.all([
      prisma.order.aggregate({
        where: { customerId: customer.id },
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.order.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNo: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      prisma.quotation.findMany({
        where: {
          customerId: customer.id,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          quotationNo: true,
          status: true,
          totalAmount: true,
          validUntil: true,
        },
      }),
    ]);

    // Count pending orders
    const pendingCount = await prisma.order.count({
      where: {
        customerId: customer.id,
        status: { in: ["CREATED", "CONFIRMED", "PROCESSING"] },
      },
    });

    return NextResponse.json({
      summary: {
        totalOrders: orderStats._count || 0,
        pendingOrders: pendingCount,
        totalSpent: Number(orderStats._sum?.totalAmount || 0),
        creditAvailable: Number(customer.creditAvailable || 0),
        creditLimit: Number(customer.creditLimit || 0),
        creditUsed: Number(customer.creditUsed || 0),
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        date: order.createdAt.toISOString().split("T")[0],
      })),
      pendingQuotations: pendingQuotations.map((quote) => ({
        id: quote.id,
        quotationNo: quote.quotationNo,
        status: quote.status,
        totalAmount: Number(quote.totalAmount),
        validUntil: quote.validUntil.toISOString().split("T")[0],
      })),
    });
  } catch (error) {
    console.error("Error fetching B2B dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
