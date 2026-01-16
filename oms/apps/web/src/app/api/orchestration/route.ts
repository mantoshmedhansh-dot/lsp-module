import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import {
  allocateWithHopping,
  calculateSLA,
  trackSLACompliance,
  selectOptimalPartner,
  checkRouteServiceability,
  generateLabelData,
} from "@/lib/intelligent-orchestration";

/**
 * Unified Order Orchestration API - OMS Backend
 *
 * Provides complete order-to-delivery orchestration:
 * 1. Serviceability validation
 * 2. SLA calculation
 * 3. Intelligent inventory allocation with hopping
 * 4. Optimal partner selection
 * 5. Label generation
 * 6. Status tracking
 */

// GET /api/orchestration - Get orchestration status or workflow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const action = searchParams.get("action");

    // Get orchestration status for specific order
    if (orderId && action === "status") {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          OrderItem: { include: { SKU: true } },
          Location: true,
          Delivery: {
            include: { Transporter: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          Picklist: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!order) {
        return NextResponse.json({
          success: false,
          error: "Order not found",
        }, { status: 404 });
      }

      const slaTracking = await trackSLACompliance(orderId).catch(() => null);
      const shippingAddress = order.shippingAddress as any;

      // Build timeline
      const timeline = [
        {
          step: "ORDER_RECEIVED",
          status: "COMPLETED",
          timestamp: order.createdAt,
          details: `Order ${order.orderNo} received`,
        },
      ];

      if (["ALLOCATED", "PICKED", "PACKED", "MANIFESTED", "DISPATCHED", "DELIVERED"].includes(order.status)) {
        timeline.push({
          step: "ALLOCATED",
          status: "COMPLETED",
          timestamp: order.updatedAt,
          details: "Inventory allocated",
        });
      }

      if (order.Picklist.length > 0) {
        timeline.push({
          step: "PICKLIST_CREATED",
          status: order.Picklist[0].status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
          timestamp: order.Picklist[0].createdAt,
          details: `Picklist ${order.Picklist[0].picklistNo}`,
        });
      }

      if (["PICKED", "PACKED", "MANIFESTED", "DISPATCHED", "DELIVERED"].includes(order.status)) {
        timeline.push({
          step: "PICKED",
          status: "COMPLETED",
          timestamp: order.updatedAt,
          details: "Items picked",
        });
      }

      if (["PACKED", "MANIFESTED", "DISPATCHED", "DELIVERED"].includes(order.status)) {
        timeline.push({
          step: "PACKED",
          status: "COMPLETED",
          timestamp: order.updatedAt,
          details: "Order packed",
        });
      }

      if (order.Delivery.length > 0 && order.Delivery[0].awbNo) {
        timeline.push({
          step: "LABEL_GENERATED",
          status: "COMPLETED",
          timestamp: order.Delivery[0].createdAt,
          details: `AWB: ${order.Delivery[0].awbNo}`,
        });
      }

      if (["DISPATCHED", "DELIVERED"].includes(order.status)) {
        timeline.push({
          step: "DISPATCHED",
          status: "COMPLETED",
          timestamp: order.updatedAt,
          details: `Handed to ${order.Delivery[0]?.Transporter?.name || "courier"}`,
        });
      }

      if (order.status === "DELIVERED") {
        timeline.push({
          step: "DELIVERED",
          status: "COMPLETED",
          timestamp: order.updatedAt,
          details: "Order delivered",
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderNo: order.orderNo,
          currentStatus: order.status,
          customer: order.customerName,
          destination: shippingAddress?.city || "Unknown",
          timeline,
          sla: slaTracking ? {
            status: slaTracking.slaStatus,
            promisedDate: slaTracking.promisedDate,
            delayMinutes: slaTracking.delayMinutes,
          } : null,
          delivery: order.Delivery[0] ? {
            awbNo: order.Delivery[0].awbNo,
            transporter: order.Delivery[0].Transporter?.name,
            status: order.Delivery[0].status,
          } : null,
        },
      });
    }

    // Get orchestration dashboard
    if (action === "dashboard") {
      const [
        totalOrders,
        pendingAllocation,
        pendingPicking,
        pendingPacking,
        readyToShip,
        inTransit,
        deliveredToday,
      ] = await Promise.all([
        prisma.order.count({ where: { status: { notIn: ["DELIVERED", "CANCELLED"] } } }),
        prisma.order.count({ where: { status: "CREATED" } }),
        prisma.order.count({ where: { status: "ALLOCATED" } }),
        prisma.order.count({ where: { status: "PICKED" } }),
        prisma.order.count({ where: { status: "PACKED" } }),
        prisma.order.count({ where: { status: "SHIPPED" } }),
        prisma.order.count({
          where: {
            status: "DELIVERED",
            updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalPending: totalOrders,
            pendingAllocation,
            pendingPicking,
            pendingPacking,
            readyToShip,
            inTransit,
            deliveredToday,
          },
        },
      });
    }

    // Return workflow definition
    return NextResponse.json({
      success: true,
      data: {
        workflow: [
          { step: 1, name: "ORDER_RECEIVED", description: "Order received from channel" },
          { step: 2, name: "SERVICEABILITY_CHECK", description: "Validate pincode serviceability" },
          { step: 3, name: "SLA_CALCULATION", description: "Calculate promised delivery date" },
          { step: 4, name: "INVENTORY_ALLOCATION", description: "Allocate inventory with hopping" },
          { step: 5, name: "PARTNER_SELECTION", description: "Select optimal courier partner" },
          { step: 6, name: "PICKLIST_GENERATION", description: "Generate optimized picklist" },
          { step: 7, name: "PICKING", description: "Pick items from warehouse" },
          { step: 8, name: "PACKING", description: "Pack order with quality check" },
          { step: 9, name: "LABEL_GENERATION", description: "Generate shipping label" },
          { step: 10, name: "DISPATCH", description: "Handover to courier" },
          { step: 11, name: "TRACKING", description: "Track shipment" },
          { step: 12, name: "DELIVERY", description: "Deliver to customer" },
        ],
      },
    });
  } catch (error) {
    console.error("Orchestration GET error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get orchestration data",
    }, { status: 500 });
  }
}

// POST /api/orchestration - Execute orchestration steps
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId } = body;

    // Execute complete orchestration for order
    if (action === "orchestrate") {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          OrderItem: { include: { SKU: true } },
          Location: true,
        },
      });

      if (!order) {
        return NextResponse.json({
          success: false,
          error: "Order not found",
        }, { status: 404 });
      }

      const shippingAddress = order.shippingAddress as any;
      const destinationPincode = shippingAddress?.pincode || "000000";
      const locationAddress = order.Location?.address as any;
      const originPincode = locationAddress?.pincode || "110001";
      const results: any[] = [];

      // Step 1: Serviceability check
      const route = await checkRouteServiceability(originPincode, destinationPincode, order.paymentMode as any);
      results.push({
        step: "SERVICEABILITY_CHECK",
        success: route.isServiceable,
        data: {
          isServiceable: route.isServiceable,
          availableTransporters: route.transporters.length,
        },
      });

      if (!route.isServiceable) {
        return NextResponse.json({
          success: false,
          error: "Route not serviceable",
          results,
        });
      }

      // Step 2: SLA calculation
      const sla = calculateSLA({
        orderType: order.priority >= 2 ? "EXPRESS" : "STANDARD",
        originPincode,
        destinationPincode,
        orderPlacedAt: order.orderDate || new Date(),
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { promisedDate: sla.promisedDeliveryDate },
      });

      results.push({
        step: "SLA_CALCULATION",
        success: true,
        data: {
          promisedDate: sla.promisedDeliveryDate,
          tatDays: sla.tatDays,
        },
      });

      // Step 3: Inventory allocation with hopping
      const allocation = await allocateWithHopping({
        orderId,
        items: order.OrderItem.map(i => ({ skuId: i.skuId, quantity: i.quantity })),
        destinationPincode,
        preferredLocationId: order.locationId || undefined,
        config: { enableHopping: true, maxHops: 3 },
      });

      results.push({
        step: "INVENTORY_ALLOCATION",
        success: allocation.success,
        data: {
          strategy: allocation.strategy,
          totalHops: allocation.totalHops,
          splitRequired: allocation.splitRequired,
        },
      });

      // Calculate total weight from order items
      const totalWeight = order.OrderItem.reduce((sum, item) => {
        const itemWeight = item.SKU?.weight ? Number(item.SKU.weight) : 0;
        return sum + (itemWeight * item.quantity);
      }, 0) || 0.5;

      // Step 4: Partner selection
      const partnerSelection = await selectOptimalPartner({
        originPincode,
        destinationPincode,
        weightKg: totalWeight,
        isCod: order.paymentMode === "COD",
        codAmount: order.paymentMode === "COD" ? Number(order.totalAmount) : 0,
      });

      results.push({
        step: "PARTNER_SELECTION",
        success: !!partnerSelection.recommended,
        data: partnerSelection.recommended ? {
          recommended: partnerSelection.recommended.transporterCode,
          rate: partnerSelection.recommended.rate,
          tatDays: partnerSelection.recommended.estimatedTatDays,
        } : null,
      });

      return NextResponse.json({
        success: allocation.success,
        data: {
          orderId,
          orchestrationId: `ORCH-${Date.now()}`,
          results,
          nextStep: allocation.success ? "PICKLIST_GENERATION" : "RESOLVE_ALLOCATION",
        },
      });
    }

    // Execute specific step
    if (action === "execute_step") {
      const { step, params } = body;

      switch (step) {
        case "ALLOCATE":
          const allocation = await allocateWithHopping(params);
          return NextResponse.json({ success: allocation.success, data: allocation });

        case "SELECT_PARTNER":
          const partner = await selectOptimalPartner(params);
          return NextResponse.json({ success: !!partner.recommended, data: partner });

        case "CALCULATE_SLA":
          const sla = calculateSLA(params);
          return NextResponse.json({ success: true, data: sla });

        case "GENERATE_LABEL":
          const label = await generateLabelData(params.orderId);
          return NextResponse.json({ success: true, data: label });

        case "TRACK_SLA":
          const tracking = await trackSLACompliance(params.orderId);
          return NextResponse.json({ success: true, data: tracking });

        default:
          return NextResponse.json({
            success: false,
            error: `Unknown step: ${step}`,
          }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action",
    }, { status: 400 });
  } catch (error) {
    console.error("Orchestration POST error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to execute orchestration",
    }, { status: 500 });
  }
}
