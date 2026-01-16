import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/deliveries - List deliveries with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const transporterId = searchParams.get("transporterId") || "";
    const manifestId = searchParams.get("manifestId") || "";
    const unmanifested = searchParams.get("unmanifested") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { deliveryNo: { contains: search, mode: "insensitive" } },
        { awbNo: { contains: search, mode: "insensitive" } },
        { order: { orderNo: { contains: search, mode: "insensitive" } } },
        { order: { customerName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (transporterId) {
      where.transporterId = transporterId;
    }

    if (manifestId) {
      where.manifestId = manifestId;
    }

    if (unmanifested) {
      where.manifestId = null;
      where.status = { in: ["PACKED"] };
      where.awbNo = { not: null };
    }

    // Filter by location access through order
    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.order = {
        ...(where.order as object || {}),
        locationId: { in: session.user.locationAccess },
      };
    }

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: {
          Order: {
            select: {
              id: true,
              orderNo: true,
              externalOrderNo: true,
              customerName: true,
              customerPhone: true,
              shippingAddress: true,
              paymentMode: true,
              totalAmount: true,
              Location: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          Transporter: {
            select: {
              id: true,
              code: true,
              name: true,
              trackingUrlTemplate: true,
            },
          },
          Manifest: {
            select: {
              id: true,
              manifestNo: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.delivery.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.delivery.groupBy({
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
      deliveries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    return NextResponse.json(
      { error: "Failed to fetch deliveries" },
      { status: 500 }
    );
  }
}
