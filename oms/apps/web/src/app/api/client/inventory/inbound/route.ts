import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/inventory/inbound - Get inbound inventory/purchase orders
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
      return NextResponse.json({ inboundOrders: [], total: 0 });
    }

    // Build where clause for GRNs
    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    if (search) {
      where.grnNo = { contains: search, mode: "insensitive" };
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [grns, total] = await Promise.all([
      prisma.gRN.findMany({
        where,
        include: {
          location: {
            select: { id: true, name: true, code: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
          items: {
            include: {
              sku: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          createdByUser: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.gRN.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.gRN.groupBy({
      by: ["status"],
      where: { companyId: user.companyId },
      _count: { _all: true },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status.toLowerCase()] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      inboundOrders: grns.map((grn) => ({
        id: grn.id,
        grnNo: grn.grnNo,
        status: grn.status,
        vendor: grn.vendor,
        location: grn.location,
        totalItems: grn.items.length,
        totalUnits: grn.items.reduce((sum, item) => sum + item.receivedQuantity, 0),
        expectedUnits: grn.items.reduce((sum, item) => sum + item.expectedQuantity, 0),
        receivedAt: grn.receivedAt?.toISOString().split("T")[0],
        createdAt: grn.createdAt.toISOString().split("T")[0],
        createdBy: grn.createdByUser?.name,
        items: grn.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          expectedQuantity: item.expectedQuantity,
          receivedQuantity: item.receivedQuantity,
          damagedQuantity: item.damagedQuantity,
          status: item.status,
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: {
        all: total,
        draft: statusCountMap.draft || 0,
        pending: statusCountMap.pending || 0,
        in_progress: statusCountMap.in_progress || 0,
        completed: statusCountMap.completed || 0,
        cancelled: statusCountMap.cancelled || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching inbound inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbound inventory" },
      { status: 500 }
    );
  }
}
