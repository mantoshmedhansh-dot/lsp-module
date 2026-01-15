import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";
import { allocateWithHopping, calculateSLA } from "@/lib/intelligent-orchestration";

/**
 * Order Allocation API with Multi-Warehouse Hopping
 *
 * Supports:
 * - Single warehouse allocation (default)
 * - Multi-warehouse allocation with hopping
 * - Automatic SLA calculation
 * - Split order handling
 */

// POST /api/orders/[id]/allocate - Allocate inventory to order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Allocation options from request body
    const {
      enableHopping = false,
      maxHops = 3,
      splitAllowed = true,
      preferredLocationId,
      calculateSlaOnAllocate = true,
    } = body;

    // Get order with items
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
        Location: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if order is in valid status for allocation
    const allocatableStatuses = ["CREATED", "CONFIRMED", "PARTIALLY_ALLOCATED"];
    if (!allocatableStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot allocate order in ${order.status} status` },
        { status: 400 }
      );
    }

    // Get destination pincode for hopping optimization
    const shippingAddress = order.shippingAddress as any;
    const destinationPincode = shippingAddress?.pincode || "000000";

    // Use intelligent allocation with hopping if enabled
    if (enableHopping) {
      const items = order.OrderItem.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity - item.allocatedQty,
      })).filter(i => i.quantity > 0);

      if (items.length === 0) {
        return NextResponse.json({
          success: true,
          message: "All items already allocated",
          orderStatus: order.status,
        });
      }

      const allocationResult = await allocateWithHopping({
        orderId: id,
        items,
        destinationPincode,
        preferredLocationId: preferredLocationId || order.locationId || undefined,
        config: { enableHopping, maxHops, splitAllowed },
      });

      // Update order items with allocation results
      for (const allocation of allocationResult.allocations) {
        const orderItem = order.OrderItem.find(i => i.skuId === allocation.skuId);
        if (orderItem) {
          await prisma.orderItem.update({
            where: { id: orderItem.id },
            data: {
              allocatedQty: orderItem.allocatedQty + allocation.allocatedQty,
              status: allocation.shortfall === 0 ? "ALLOCATED" : "PENDING",
            },
          });
        }
      }

      // Calculate and update SLA if requested
      let slaData = null;
      if (calculateSlaOnAllocate && !order.promisedDate) {
        const sla = calculateSLA({
          orderType: order.priority >= 2 ? "EXPRESS" : "STANDARD",
          originPincode: (order.Location?.address as any)?.pincode || "110001",
          destinationPincode,
          orderPlacedAt: order.orderDate || new Date(),
        });

        await prisma.order.update({
          where: { id },
          data: { promisedDate: sla.promisedDeliveryDate },
        });

        slaData = {
          promisedDeliveryDate: sla.promisedDeliveryDate,
          tatDays: sla.tatDays,
          riskLevel: sla.riskLevel,
        };
      }

      return NextResponse.json({
        success: allocationResult.success,
        orderStatus: allocationResult.success ? "ALLOCATED" : "PARTIALLY_ALLOCATED",
        strategy: allocationResult.strategy,
        allocations: allocationResult.allocations,
        totalHops: allocationResult.totalHops,
        splitRequired: allocationResult.splitRequired,
        sla: slaData,
        message: allocationResult.success
          ? `Allocated successfully${allocationResult.splitRequired ? " (split shipment)" : ""}`
          : "Partial allocation - some items have shortfall",
      });
    }

    // Standard single-location allocation (original logic)
    const locationWithZones = await prisma.location.findUnique({
      where: { id: order.locationId || "" },
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
    });

    if (!locationWithZones) {
      return NextResponse.json(
        { error: "Location not found or no zones configured" },
        { status: 400 }
      );
    }

    const allocationResults = [];
    let fullyAllocated = true;

    // Process each order item
    for (const item of order.OrderItem) {
      const requiredQty = item.quantity - item.allocatedQty;

      if (requiredQty <= 0) {
        allocationResults.push({
          skuId: item.skuId,
          skuCode: item.SKU.code,
          required: item.quantity,
          allocated: item.allocatedQty,
          status: "already_allocated",
        });
        continue;
      }

      // Find available inventory in saleable zones
      let allocatedQty = 0;

      for (const zone of locationWithZones.Zone) {
        if (allocatedQty >= requiredQty) break;

        for (const bin of zone.Bin) {
          if (allocatedQty >= requiredQty) break;

          const inventory = bin.Inventory.find(
            (inv) => inv.skuId === item.skuId
          );

          if (inventory) {
            const availableQty = inventory.quantity - inventory.reservedQty;
            const toAllocate = Math.min(availableQty, requiredQty - allocatedQty);

            if (toAllocate > 0) {
              // Reserve inventory
              await prisma.inventory.update({
                where: { id: inventory.id },
                data: {
                  reservedQty: inventory.reservedQty + toAllocate,
                },
              });

              allocatedQty += toAllocate;
            }
          }
        }
      }

      // Update order item
      const newAllocatedQty = item.allocatedQty + allocatedQty;
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          allocatedQty: newAllocatedQty,
          status: newAllocatedQty >= item.quantity ? "ALLOCATED" : "PENDING",
        },
      });

      if (newAllocatedQty < item.quantity) {
        fullyAllocated = false;
      }

      allocationResults.push({
        skuId: item.skuId,
        skuCode: item.SKU.code,
        required: item.quantity,
        previouslyAllocated: item.allocatedQty,
        newlyAllocated: allocatedQty,
        totalAllocated: newAllocatedQty,
        status: newAllocatedQty >= item.quantity ? "fully_allocated" : "partial",
      });
    }

    // Update order status
    const newStatus = fullyAllocated ? "ALLOCATED" : "PARTIALLY_ALLOCATED";
    await prisma.order.update({
      where: { id },
      data: { status: newStatus },
    });

    // Calculate SLA if not set
    let slaData = null;
    if (calculateSlaOnAllocate && !order.promisedDate) {
      const sla = calculateSLA({
        orderType: order.priority >= 2 ? "EXPRESS" : "STANDARD",
        originPincode: (locationWithZones.address as any)?.pincode || "110001",
        destinationPincode,
        orderPlacedAt: order.orderDate || new Date(),
      });

      await prisma.order.update({
        where: { id },
        data: { promisedDate: sla.promisedDeliveryDate },
      });

      slaData = {
        promisedDeliveryDate: sla.promisedDeliveryDate,
        tatDays: sla.tatDays,
        riskLevel: sla.riskLevel,
      };
    }

    return NextResponse.json({
      success: true,
      orderStatus: newStatus,
      fullyAllocated,
      items: allocationResults,
      sla: slaData,
    });
  } catch (error) {
    console.error("Error allocating order:", error);
    return NextResponse.json(
      { error: "Failed to allocate order" },
      { status: 500 }
    );
  }
}
