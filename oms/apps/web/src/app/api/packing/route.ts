import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/packing - Get orders ready for packing
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "PICKED"; // Default to picked orders
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      status: { in: ["PICKED", "PACKING", "PACKED"] },
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: "insensitive" } },
        { externalOrderNo: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by location access
    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          Location: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          OrderItem: {
            include: {
              SKU: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  weight: true,
                  length: true,
                  width: true,
                  height: true,
                },
              },
            },
          },
          Delivery: {
            select: {
              id: true,
              deliveryNo: true,
              status: true,
              boxes: true,
              weight: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Get status counts
    const statusFilter = session.user.locationAccess?.length
      ? { locationId: { in: session.user.locationAccess } }
      : {};

    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      where: {
        ...statusFilter,
        status: { in: ["PICKED", "PACKING", "PACKED"] },
      },
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
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching packing orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders for packing" },
      { status: 500 }
    );
  }
}
