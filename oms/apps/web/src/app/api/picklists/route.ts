import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate picklist number
function generatePicklistNo(): string {
  const prefix = "PL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/picklists - List picklists with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { picklistNo: { contains: search, mode: "insensitive" } },
        { Order: { orderNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (assignedToMe && session.user.id) {
      where.assignedToId = session.user.id;
    }

    // Filter by location access
    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.Order = {
        ...(where.Order as object || {}),
        locationId: { in: session.user.locationAccess },
      };
    }

    const [picklists, total] = await Promise.all([
      prisma.picklist.findMany({
        where,
        include: {
          Order: {
            select: {
              id: true,
              orderNo: true,
              customerName: true,
              status: true,
              Location: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          PicklistItem: {
            include: {
              SKU: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              Bin: {
                select: {
                  id: true,
                  code: true,
                  Zone: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              PicklistItem: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.picklist.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.picklist.groupBy({
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
      picklists,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching picklists:", error);
    return NextResponse.json(
      { error: "Failed to fetch picklists" },
      { status: 500 }
    );
  }
}

// POST /api/picklists - Generate picklist from order(s)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderIds } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "Order IDs are required" },
        { status: 400 }
      );
    }

    const createdPicklists = [];

    for (const orderId of orderIds) {
      // Get order with items and location
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          OrderItem: {
            where: {
              allocatedQty: { gt: 0 },
              status: { in: ["ALLOCATED", "PENDING"] },
            },
            include: {
              SKU: true,
            },
          },
          Location: {
            include: {
              Zone: {
                where: { type: "SALEABLE" },
                include: {
                  Bin: {
                    include: {
                      Inventory: true,
                    },
                  },
                },
              },
            },
          },
          Picklist: {
            where: {
              status: { in: ["PENDING", "PROCESSING"] },
            },
          },
        },
      });

      if (!order) {
        continue;
      }

      // Check if order already has an active picklist
      if (order.Picklist.length > 0) {
        continue;
      }

      // Check if order is in valid status
      if (!["ALLOCATED", "PARTIALLY_ALLOCATED", "CONFIRMED"].includes(order.status)) {
        continue;
      }

      // Create picklist items - find bins with inventory for each SKU
      const picklistItems: Array<{
        skuId: string;
        binId: string;
        requiredQty: number;
      }> = [];

      for (const item of order.OrderItem) {
        let remainingQty = item.allocatedQty;

        for (const zone of order.Location.Zone) {
          if (remainingQty <= 0) break;

          for (const bin of zone.Bin) {
            if (remainingQty <= 0) break;

            const inventory = bin.Inventory.find(
              (inv) => inv.skuId === item.skuId && inv.reservedQty > 0
            );

            if (inventory) {
              const qtyFromBin = Math.min(inventory.reservedQty, remainingQty);
              picklistItems.push({
                skuId: item.skuId,
                binId: bin.id,
                requiredQty: qtyFromBin,
              });
              remainingQty -= qtyFromBin;
            }
          }
        }

        // If we couldn't find enough inventory, use default bin
        if (remainingQty > 0 && order.Location.Zone[0]?.Bin[0]) {
          picklistItems.push({
            skuId: item.skuId,
            binId: order.Location.Zone[0].Bin[0].id,
            requiredQty: remainingQty,
          });
        }
      }

      if (picklistItems.length === 0) {
        continue;
      }

      // Create picklist
      const picklist = await prisma.picklist.create({
        data: {
          picklistNo: generatePicklistNo(),
          status: "PENDING",
          orderId: order.id,
          PicklistItem: {
            create: picklistItems,
          },
        },
        include: {
          PicklistItem: true,
          Order: {
            select: {
              orderNo: true,
            },
          },
        },
      });

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "PICKLIST_GENERATED" },
      });

      createdPicklists.push(picklist);
    }

    return NextResponse.json({
      success: true,
      created: createdPicklists.length,
      picklists: createdPicklists,
    });
  } catch (error) {
    console.error("Error generating picklists:", error);
    return NextResponse.json(
      { error: "Failed to generate picklists" },
      { status: 500 }
    );
  }
}
