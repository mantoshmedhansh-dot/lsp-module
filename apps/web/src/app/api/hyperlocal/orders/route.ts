import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Hyperlocal Orders API
// For 15-min express, same-day, and scheduled deliveries

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const darkStoreId = searchParams.get("darkStoreId");
    const riderId = searchParams.get("riderId");
    const status = searchParams.get("status");
    const orderType = searchParams.get("orderType");

    const where: any = {};
    if (darkStoreId) where.darkStoreId = darkStoreId;
    if (riderId) where.riderId = riderId;
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;

    const orders = await prisma.hyperlocalOrder.findMany({
      where,
      include: {
        darkStore: { select: { code: true, name: true, address: true } },
        rider: { select: { riderCode: true, name: true, phone: true, status: true } },
        slot: { select: { name: true, startTime: true, endTime: true } },
      },
      orderBy: { promisedDeliveryTime: "asc" },
      take: 100,
    });

    // Summary by status
    const summary = {
      pending: await prisma.hyperlocalOrder.count({ where: { ...where, status: "PENDING" } }),
      confirmed: await prisma.hyperlocalOrder.count({ where: { ...where, status: "CONFIRMED" } }),
      picking: await prisma.hyperlocalOrder.count({ where: { ...where, status: "PICKING" } }),
      inTransit: await prisma.hyperlocalOrder.count({ where: { ...where, status: "IN_TRANSIT" } }),
      delivered: await prisma.hyperlocalOrder.count({ where: { ...where, status: "DELIVERED" } }),
      failed: await prisma.hyperlocalOrder.count({ where: { ...where, status: "FAILED" } }),
    };

    return NextResponse.json({
      success: true,
      data: { items: orders, summary },
    });
  } catch (error) {
    console.error("Error fetching hyperlocal orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CREATE_ORDER": {
        // Find nearest dark store that can service this delivery
        const darkStore = await prisma.darkStore.findFirst({
          where: {
            isActive: true,
            servicePincodes: { contains: body.deliveryPincode },
          },
        });

        if (!darkStore) {
          return NextResponse.json(
            { success: false, error: "No dark store available for this pincode" },
            { status: 400 }
          );
        }

        // Generate order number
        const orderNumber = `HL${Date.now().toString(36).toUpperCase()}`;

        // Calculate promised delivery time based on order type
        const now = new Date();
        let promisedDeliveryTime: Date;
        switch (body.orderType) {
          case "EXPRESS":
            promisedDeliveryTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins
            break;
          case "SAME_DAY":
            promisedDeliveryTime = new Date(now.setHours(21, 0, 0, 0)); // Today 9 PM
            break;
          case "SCHEDULED":
            promisedDeliveryTime = new Date(body.scheduledTime);
            break;
          default:
            promisedDeliveryTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        }

        // Calculate surge if applicable
        const currentHour = new Date().getHours();
        const isSurgeHour = currentHour >= 12 && currentHour <= 14 || currentHour >= 19 && currentHour <= 21;
        const surgeMultiplier = isSurgeHour ? 1.3 : 1;
        const baseDeliveryCharge = body.orderType === "EXPRESS" ? 49 : body.orderType === "SAME_DAY" ? 29 : 19;
        const deliveryCharge = Math.round(baseDeliveryCharge * surgeMultiplier);
        const surgeFee = deliveryCharge - baseDeliveryCharge;

        const order = await prisma.hyperlocalOrder.create({
          data: {
            orderNumber,
            darkStoreId: darkStore.id,
            orderType: body.orderType || "EXPRESS",
            priority: body.priority || "NORMAL",
            customerId: body.customerId,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            customerEmail: body.customerEmail,
            deliveryAddress: body.deliveryAddress,
            deliveryLat: body.deliveryLat,
            deliveryLng: body.deliveryLng,
            deliveryPincode: body.deliveryPincode,
            deliveryInstructions: body.deliveryInstructions,
            slotId: body.slotId,
            promisedDeliveryTime,
            itemCount: body.itemCount || 1,
            itemDetails: body.itemDetails ? JSON.stringify(body.itemDetails) : null,
            totalWeight: body.totalWeight || 0,
            itemValue: body.itemValue || 0,
            deliveryCharge,
            surgeFee,
            discount: body.discount || 0,
            totalAmount: (body.itemValue || 0) + deliveryCharge - (body.discount || 0),
            paymentMode: body.paymentMode || "PREPAID",
            paymentStatus: body.paymentMode === "COD" ? "PENDING" : "PAID",
            codAmount: body.paymentMode === "COD" ? (body.itemValue || 0) + deliveryCharge - (body.discount || 0) : 0,
            status: "PENDING",
          },
          include: {
            darkStore: { select: { code: true, name: true } },
          },
        });

        // Auto-assign rider if EXPRESS order
        if (body.orderType === "EXPRESS") {
          const availableRider = await prisma.hyperlocalRider.findFirst({
            where: {
              darkStoreId: darkStore.id,
              status: "ONLINE",
              isActive: true,
            },
            orderBy: { todayDeliveries: "asc" }, // Assign to least busy rider
          });

          if (availableRider) {
            await prisma.hyperlocalOrder.update({
              where: { id: order.id },
              data: {
                riderId: availableRider.id,
                riderAssignedAt: new Date(),
                status: "CONFIRMED",
              },
            });

            await prisma.hyperlocalRider.update({
              where: { id: availableRider.id },
              data: { status: "BUSY" },
            });
          }
        }

        return NextResponse.json({ success: true, data: order });
      }

      case "ASSIGN_RIDER": {
        const { orderId, riderId } = body;

        const [order, rider] = await Promise.all([
          prisma.hyperlocalOrder.update({
            where: { id: orderId },
            data: {
              riderId,
              riderAssignedAt: new Date(),
              status: "CONFIRMED",
            },
          }),
          prisma.hyperlocalRider.update({
            where: { id: riderId },
            data: { status: "BUSY" },
          }),
        ]);

        return NextResponse.json({ success: true, data: order });
      }

      case "UPDATE_STATUS": {
        const { orderId, status, reason } = body;
        const updateData: any = {
          status,
          statusUpdatedAt: new Date(),
        };

        if (status === "PICKED") updateData.actualPickupTime = new Date();
        if (status === "DELIVERED") updateData.actualDeliveryTime = new Date();
        if (status === "CANCELLED") updateData.cancellationReason = reason;
        if (status === "FAILED") updateData.failureReason = reason;

        const order = await prisma.hyperlocalOrder.update({
          where: { id: orderId },
          data: updateData,
        });

        // Free up rider if delivered/cancelled/failed
        if (["DELIVERED", "CANCELLED", "FAILED"].includes(status) && order.riderId) {
          await prisma.hyperlocalRider.update({
            where: { id: order.riderId },
            data: {
              status: "ONLINE",
              todayDeliveries: status === "DELIVERED" ? { increment: 1 } : undefined,
              totalDeliveries: status === "DELIVERED" ? { increment: 1 } : undefined,
            },
          });
        }

        return NextResponse.json({ success: true, data: order });
      }

      case "COMPLETE_DELIVERY": {
        const { orderId, podSignature, podPhoto, podOtp, deliveredTo, codCollected } = body;

        const order = await prisma.hyperlocalOrder.update({
          where: { id: orderId },
          data: {
            status: "DELIVERED",
            statusUpdatedAt: new Date(),
            actualDeliveryTime: new Date(),
            podSignature,
            podPhoto,
            podOtp,
            deliveredTo,
            codCollected: codCollected || 0,
            paymentStatus: "PAID",
          },
        });

        // Update rider stats
        if (order.riderId) {
          await prisma.hyperlocalRider.update({
            where: { id: order.riderId },
            data: {
              status: "ONLINE",
              todayDeliveries: { increment: 1 },
              totalDeliveries: { increment: 1 },
            },
          });
        }

        return NextResponse.json({ success: true, data: order });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in hyperlocal order API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
