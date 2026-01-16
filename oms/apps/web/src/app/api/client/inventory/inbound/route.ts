import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/inventory/inbound - Get inbound inventory
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
      include: { Company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ inboundOrders: [], total: 0 });
    }

    // Build where clause for Inbounds
    const where: Record<string, unknown> = {
      Location: { companyId: user.companyId },
    };

    if (search) {
      where.OR = [
        { inboundNo: { contains: search, mode: "insensitive" } },
        { grnNo: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [inbounds, total] = await Promise.all([
      prisma.inbound.findMany({
        where,
        include: {
          Location: {
            select: { id: true, name: true, code: true },
          },
          User: {
            select: { name: true },
          },
          InboundItem: {
            include: {
              SKU: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inbound.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.inbound.groupBy({
      by: ["status"],
      where: { Location: { companyId: user.companyId } },
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
      inboundOrders: inbounds.map((inbound) => ({
        id: inbound.id,
        inboundNo: inbound.inboundNo,
        grnNo: inbound.grnNo,
        status: inbound.status,
        type: inbound.type,
        location: inbound.Location,
        totalItems: inbound.InboundItem.length,
        totalUnits: inbound.InboundItem.reduce((sum, item) => sum + item.receivedQty, 0),
        expectedUnits: inbound.InboundItem.reduce((sum, item) => sum + (item.expectedQty || 0), 0),
        completedAt: inbound.completedAt?.toISOString().split("T")[0],
        createdAt: inbound.createdAt.toISOString().split("T")[0],
        createdBy: inbound.User?.name,
        items: inbound.InboundItem.map((item) => ({
          id: item.id,
          sku: item.SKU,
          expectedQuantity: item.expectedQty,
          receivedQuantity: item.receivedQty,
          acceptedQuantity: item.acceptedQty,
          rejectedQuantity: item.rejectedQty,
          qcStatus: item.qcStatus,
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: {
        all: total,
        pending: statusCountMap.pending || 0,
        in_progress: statusCountMap.in_progress || 0,
        qc_pending: statusCountMap.qc_pending || 0,
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
