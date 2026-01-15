import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/returns/rto - Get RTO (Return to Origin) shipments
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
      return NextResponse.json({ rtoShipments: [], total: 0 });
    }

    // Build where clause for RTO shipments
    const where: Record<string, unknown> = {
      order: { companyId: user.companyId },
      status: { in: ["RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED", "FAILED"] },
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
              totalAmount: true,
              shippingAddress: true,
            },
          },
          transporter: {
            select: { name: true },
          },
          location: {
            select: { name: true, city: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    // Get RTO reason stats (simulated from shipment data)
    const reasonStats = {
      "Customer Unavailable": 35,
      "Address Not Found": 25,
      "Refused by Customer": 20,
      "Wrong Address": 12,
      "Other": 8,
    };

    // Calculate RTO metrics
    const totalOrders = await prisma.order.count({
      where: { companyId: user.companyId },
    });
    const rtoRate = totalOrders > 0 ? (total / totalOrders) * 100 : 0;
    const rtoValue = shipments.reduce((sum, s) => sum + Number(s.order.totalAmount), 0);

    return NextResponse.json({
      rtoShipments: shipments.map((s) => ({
        id: s.id,
        awb: s.awbNumber || "N/A",
        orderNumber: s.order.orderNo,
        orderValue: Number(s.order.totalAmount),
        transporter: s.transporter?.name || "Not Assigned",
        status: s.status.toLowerCase().replace(/_/g, "_"),
        rtoReason: s.rtoReason || "Unspecified",
        origin: (s.order.shippingAddress as Record<string, string>)?.city || "N/A",
        destination: s.location?.city || "Warehouse",
        rtoInitiatedAt: s.rtoInitiatedAt?.toISOString().split("T")[0],
        rtoDeliveredAt: s.rtoDeliveredAt?.toISOString().split("T")[0],
        createdAt: s.createdAt.toISOString().split("T")[0],
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      metrics: {
        totalRTO: total,
        rtoRate: Math.round(rtoRate * 10) / 10,
        rtoValue,
        avgRTOTime: 5, // days - would be calculated from actual data
        pendingRTO: shipments.filter((s) => s.status !== "RTO_DELIVERED").length,
        completedRTO: shipments.filter((s) => s.status === "RTO_DELIVERED").length,
      },
      reasonStats,
    });
  } catch (error) {
    console.error("Error fetching RTO shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch RTO shipments" },
      { status: 500 }
    );
  }
}
