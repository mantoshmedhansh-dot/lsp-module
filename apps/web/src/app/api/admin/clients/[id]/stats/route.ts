import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getAdminUser } from "@/lib/admin-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: clientId } = await params;

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    // Get order statistics
    const [
      totalOrders,
      pendingOrders,
      inTransitOrders,
      deliveredOrders,
      failedOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { clientId } }),
      prisma.order.count({
        where: { clientId, status: { in: ["PENDING", "PENDING_PICKUP"] } },
      }),
      prisma.order.count({
        where: { clientId, status: "IN_TRANSIT" },
      }),
      prisma.order.count({
        where: { clientId, status: "DELIVERED" },
      }),
      prisma.order.count({
        where: { clientId, status: { in: ["FAILED", "CANCELLED", "RTO"] } },
      }),
    ]);

    // Get pickup statistics
    const [totalPickups, pendingPickups, completedPickups] = await Promise.all([
      prisma.pickupRequest.count({ where: { clientId } }),
      prisma.pickupRequest.count({
        where: { clientId, status: { in: ["PENDING", "SCHEDULED"] } },
      }),
      prisma.pickupRequest.count({
        where: { clientId, status: "COMPLETED" },
      }),
    ]);

    // Get other counts
    const [openTickets, totalWarehouses, totalUsers] = await Promise.all([
      prisma.supportTicket.count({
        where: { clientId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.warehouse.count({ where: { clientId } }),
      prisma.clientUser.count({ where: { clientId } }),
    ]);

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        customerName: true,
        deliveryCity: true,
      },
    });

    // Get recent pickups
    const recentPickups = await prisma.pickupRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        pickupNumber: true,
        status: true,
        requestedDate: true,
        warehouse: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        inTransitOrders,
        deliveredOrders,
        failedOrders,
        totalPickups,
        pendingPickups,
        completedPickups,
        openTickets,
        totalWarehouses,
        totalUsers,
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          consigneeName: o.customerName,
          destinationCity: o.deliveryCity,
        })),
        recentPickups: recentPickups.map((p) => ({
          id: p.id,
          pickupNumber: p.pickupNumber,
          status: p.status,
          scheduledDate: p.requestedDate?.toISOString() || null,
          warehouseName: p.warehouse?.name || "Unknown",
        })),
      },
    });
  } catch (error) {
    console.error("Client stats error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
