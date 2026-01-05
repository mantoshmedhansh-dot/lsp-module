import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

export async function GET(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get order counts by status
    const [
      awaitingPickup,
      inTransit,
      exceptions,
      delivered,
      deliveredToday,
      totalOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          clientId: client.id,
          status: { in: ["CREATED", "MANIFESTED", "PICKUP_SCHEDULED"] },
        },
      }),
      prisma.order.count({
        where: {
          clientId: client.id,
          status: { in: ["PICKED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
        },
      }),
      prisma.order.count({
        where: {
          clientId: client.id,
          status: { in: ["NDR", "RTO_INITIATED", "EXCEPTION"] },
        },
      }),
      prisma.order.count({
        where: {
          clientId: client.id,
          status: "DELIVERED",
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.order.count({
        where: {
          clientId: client.id,
          status: "DELIVERED",
          deliveredAt: { gte: todayStart },
        },
      }),
      prisma.order.count({
        where: {
          clientId: client.id,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        awaitingPickup,
        inTransit,
        exceptions,
        delivered,
        deliveredToday,
        totalOrders,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
