import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/shipments - Get shipments for client
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ shipments: [], total: 0 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      order: { companyId: user.companyId },
    };

    if (search) {
      where.OR = [
        { awbNumber: { contains: search, mode: "insensitive" } },
        { order: { orderNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNo: true,
              shippingAddress: true,
            },
          },
          transporter: {
            select: { name: true, trackingUrlPattern: true },
          },
          location: {
            select: { name: true, city: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.shipment.groupBy({
      by: ["status"],
      where: { order: { companyId: user.companyId } },
      _count: { _all: true },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        const key = item.status.toLowerCase().replace("_", "_");
        acc[key] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    // Map status to frontend format
    const statusMapping: Record<string, string> = {
      CREATED: "pending",
      PICKED_UP: "in_transit",
      IN_TRANSIT: "in_transit",
      OUT_FOR_DELIVERY: "out_for_delivery",
      DELIVERED: "delivered",
      FAILED: "exception",
      RTO_INITIATED: "exception",
      RTO_DELIVERED: "exception",
    };

    return NextResponse.json({
      shipments: shipments.map((s) => ({
        id: s.id,
        awb: s.awbNumber || "Pending",
        orderNumber: s.order.orderNo,
        transporter: s.transporter?.name || "Not Assigned",
        status: statusMapping[s.status] || "pending",
        origin: s.location?.city || "N/A",
        destination: (s.order.shippingAddress as Record<string, string>)?.city || "N/A",
        estimatedDelivery: s.expectedDelivery?.toISOString().split("T")[0] || "TBD",
        actualDelivery: s.deliveredAt?.toISOString().split("T")[0],
        weight: Number(s.weight || 0),
        createdAt: s.createdAt.toISOString().split("T")[0],
        trackingUrl: s.transporter?.trackingUrlPattern?.replace("{awb}", s.awbNumber || ""),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: {
        all: total,
        pending: (statusCountMap.created || 0),
        in_transit: (statusCountMap.in_transit || 0) + (statusCountMap.picked_up || 0),
        out_for_delivery: statusCountMap.out_for_delivery || 0,
        delivered: statusCountMap.delivered || 0,
        exception: (statusCountMap.failed || 0) + (statusCountMap.rto_initiated || 0) + (statusCountMap.rto_delivered || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 }
    );
  }
}
