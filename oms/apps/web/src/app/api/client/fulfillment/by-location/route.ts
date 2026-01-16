import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/fulfillment/by-location - Get fulfillment metrics by location
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ locations: [] });
    }

    // Get all locations for the company
    const locations = await prisma.location.findMany({
      where: { companyId: user.companyId, isActive: true },
      include: {
        Order: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        Inventory: {
          select: { quantity: true, reservedQty: true },
        },
      },
    });

    // Calculate metrics for each location
    const locationMetrics = locations.map((location) => {
      const totalOrders = location.Order.length;
      const pendingOrders = location.Order.filter((o) =>
        ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status)
      ).length;
      const shippedOrders = location.Order.filter((o) => o.status === "SHIPPED").length;
      const deliveredOrders = location.Order.filter((o) => o.status === "DELIVERED").length;
      const totalRevenue = location.Order
        .filter((o) => o.status === "DELIVERED")
        .reduce((sum, o) => sum + Number(o.totalAmount), 0);

      const totalStock = location.Inventory.reduce((sum, i) => sum + (i.quantity - i.reservedQty), 0);
      const reservedStock = location.Inventory.reduce((sum, i) => sum + i.reservedQty, 0);

      // Calculate fulfillment rate
      const completedOrders = deliveredOrders + shippedOrders;
      const fulfillmentRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      // Calculate average processing time (mock calculation)
      const avgProcessingTime = 24; // hours

      const address = location.address as Record<string, string> | null;
      return {
        id: location.id,
        name: location.name,
        code: location.code,
        city: address?.city || "",
        state: address?.state || "",
        type: location.type,
        metrics: {
          totalOrders,
          pendingOrders,
          shippedOrders,
          deliveredOrders,
          totalRevenue,
          fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
          avgProcessingTime,
          totalStock,
          reservedStock,
          availableStock: totalStock - reservedStock,
        },
      };
    });

    // Calculate totals
    const totals = {
      totalOrders: locationMetrics.reduce((sum, l) => sum + l.metrics.totalOrders, 0),
      pendingOrders: locationMetrics.reduce((sum, l) => sum + l.metrics.pendingOrders, 0),
      deliveredOrders: locationMetrics.reduce((sum, l) => sum + l.metrics.deliveredOrders, 0),
      totalRevenue: locationMetrics.reduce((sum, l) => sum + l.metrics.totalRevenue, 0),
      totalStock: locationMetrics.reduce((sum, l) => sum + l.metrics.totalStock, 0),
    };

    return NextResponse.json({
      locations: locationMetrics,
      totals,
    });
  } catch (error) {
    console.error("Error fetching fulfillment by location:", error);
    return NextResponse.json(
      { error: "Failed to fetch fulfillment data" },
      { status: 500 }
    );
  }
}
