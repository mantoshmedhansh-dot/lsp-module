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

    // Get the B2B customer associated with this user
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { userId: session.user.id },
        ],
      },
    });

    if (!customer) {
      // Return empty dashboard if no customer linked
      return NextResponse.json({
        summary: {
          totalOrders: 0,
          pendingOrders: 0,
          totalSpent: 0,
          creditAvailable: 0,
          creditLimit: 0,
        },
        recentOrders: [],
        pendingQuotations: [],
      });
    }

    // Get order summary
    const [orderStats, recentOrders, pendingQuotations] = await Promise.all([
      prisma.order.aggregate({
        where: { customerId: customer.id },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.order.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      prisma.quotation.findMany({
        where: {
          customerId: customer.id,
          status: { in: ["PENDING_APPROVAL", "APPROVED"] },
          validUntil: { gte: new Date() },
        },
        orderBy: { validUntil: "asc" },
        take: 5,
        select: {
          id: true,
          quotationNumber: true,
          totalAmount: true,
          validUntil: true,
        },
      }),
    ]);

    const pendingOrders = await prisma.order.count({
      where: {
        customerId: customer.id,
        status: { in: ["PENDING", "PROCESSING", "SHIPPED", "IN_TRANSIT"] },
      },
    });

    return NextResponse.json({
      summary: {
        totalOrders: orderStats._count._all || 0,
        pendingOrders,
        totalSpent: Number(orderStats._sum.totalAmount || 0),
        creditAvailable: Number(customer.creditAvailable || 0),
        creditLimit: Number(customer.creditLimit || 0),
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt.toISOString().split("T")[0],
      })),
      pendingQuotations: pendingQuotations.map((quote) => ({
        id: quote.id,
        quotationNumber: quote.quotationNumber,
        totalAmount: Number(quote.totalAmount),
        expiresAt: quote.validUntil.toISOString().split("T")[0],
      })),
    });
  } catch (error) {
    console.error("Error fetching B2B dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
