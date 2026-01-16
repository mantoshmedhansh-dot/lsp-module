import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/inventory/movements - List inventory movements
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || ""; // IN, OUT, TRANSFER
    const skuId = searchParams.get("skuId") || "";
    const referenceType = searchParams.get("referenceType") || ""; // ORDER, INBOUND, ADJUSTMENT, TRANSFER
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (skuId) {
      where.skuId = skuId;
    }

    if (referenceType) {
      where.referenceType = referenceType;
    }

    if (search) {
      where.OR = [
        { movementNo: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } },
      ];
    }

    if (fromDate) {
      where.performedAt = {
        ...(where.performedAt as object || {}),
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.performedAt = {
        ...(where.performedAt as object || {}),
        lte: new Date(toDate + "T23:59:59"),
      };
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        orderBy: { performedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    // Get SKU and bin details
    const movementsWithDetails = await Promise.all(
      movements.map(async (movement) => {
        const [sku, fromBin, toBin, performer] = await Promise.all([
          prisma.sKU.findUnique({
            where: { id: movement.skuId },
            select: { id: true, code: true, name: true },
          }),
          movement.fromBinId
            ? prisma.bin.findUnique({
                where: { id: movement.fromBinId },
                select: {
                  id: true,
                  code: true,
                  Zone: { select: { code: true, name: true } },
                },
              })
            : null,
          movement.toBinId
            ? prisma.bin.findUnique({
                where: { id: movement.toBinId },
                select: {
                  id: true,
                  code: true,
                  Zone: { select: { code: true, name: true } },
                },
              })
            : null,
          prisma.user.findUnique({
            where: { id: movement.performedBy },
            select: { id: true, name: true },
          }),
        ]);

        return {
          ...movement,
          sku,
          fromBin,
          toBin,
          performedByUser: performer,
        };
      })
    );

    // Get type counts
    const typeCounts = await prisma.inventoryMovement.groupBy({
      by: ["type"],
      _count: { _all: true },
    });

    const typeCountMap = typeCounts.reduce(
      (acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      movements: movementsWithDetails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      typeCounts: typeCountMap,
    });
  } catch (error) {
    console.error("Error fetching movements:", error);
    return NextResponse.json(
      { error: "Failed to fetch movements" },
      { status: 500 }
    );
  }
}
