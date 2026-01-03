import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Consumer Tracking API
// For B2C shipment tracking from consumer mobile app

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const awbNumber = searchParams.get("awb");
    const consumerId = searchParams.get("consumerId");

    if (awbNumber) {
      // Track a specific shipment
      const shipment = await prisma.shipment.findFirst({
        where: { awbNumber },
        include: {
          scans: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!shipment) {
        return NextResponse.json(
          { success: false, error: "Shipment not found" },
          { status: 404 }
        );
      }

      // Format tracking data for consumer app
      const trackingData = {
        awbNumber: shipment.awbNumber,
        status: shipment.status,
        currentLocation: shipment.currentHubId,
        estimatedDelivery: shipment.expectedDeliveryDate,
        origin: {
          city: shipment.shipperCity,
          state: shipment.shipperState,
        },
        destination: {
          city: shipment.consigneeCity,
          state: shipment.consigneeState,
        },
        consignee: {
          name: shipment.consigneeName,
          // Hide full phone for privacy
          phone: shipment.consigneePhone?.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"),
        },
        timeline: shipment.scans.map((scan) => ({
          status: scan.scanType,
          location: scan.hubId,
          timestamp: scan.createdAt,
          remarks: scan.remarks,
        })),
        pod: shipment.podSignature || shipment.podPhoto ? {
          signature: shipment.podSignature,
          photo: shipment.podPhoto,
          receivedBy: shipment.podReceiverName,
          deliveredAt: shipment.actualDeliveryDate,
        } : null,
      };

      return NextResponse.json({ success: true, data: trackingData });
    }

    if (consumerId) {
      // Get all subscribed shipments for a consumer
      const subscriptions = await prisma.trackingSubscription.findMany({
        where: {
          consumerId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const awbNumbers = subscriptions.map((s) => s.awbNumber);
      const shipments = await prisma.shipment.findMany({
        where: { awbNumber: { in: awbNumbers } },
        select: {
          awbNumber: true,
          status: true,
          consigneeCity: true,
          expectedDeliveryDate: true,
          consigneeName: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: { subscriptions, shipments },
      });
    }

    return NextResponse.json(
      { success: false, error: "AWB number or consumer ID required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching tracking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tracking" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "SUBSCRIBE": {
        const { consumerId, awbNumber, phone, email } = body;

        // Check if shipment exists
        const shipment = await prisma.shipment.findFirst({
          where: { awbNumber },
        });

        if (!shipment) {
          return NextResponse.json(
            { success: false, error: "Shipment not found" },
            { status: 404 }
          );
        }

        // Create or update subscription
        const subscription = await prisma.trackingSubscription.upsert({
          where: {
            awbNumber_subscriberPhone: {
              awbNumber,
              subscriberPhone: phone || "",
            },
          },
          create: {
            consumerId,
            awbNumber,
            shipmentId: shipment.id,
            subscriberPhone: phone,
            subscriberEmail: email,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
          update: {
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        return NextResponse.json({ success: true, data: subscription });
      }

      case "UNSUBSCRIBE": {
        const { subscriptionId } = body;

        await prisma.trackingSubscription.update({
          where: { id: subscriptionId },
          data: { isActive: false },
        });

        return NextResponse.json({ success: true, data: { message: "Unsubscribed" } });
      }

      case "UPDATE_PREFERENCES": {
        const { subscriptionId, preferences } = body;

        const subscription = await prisma.trackingSubscription.update({
          where: { id: subscriptionId },
          data: {
            notifyOnPickup: preferences.notifyOnPickup,
            notifyOnTransit: preferences.notifyOnTransit,
            notifyOnOutForDelivery: preferences.notifyOnOutForDelivery,
            notifyOnDelivered: preferences.notifyOnDelivered,
            notifyOnException: preferences.notifyOnException,
          },
        });

        return NextResponse.json({ success: true, data: subscription });
      }

      case "RATE_DELIVERY": {
        const { consumerId, awbNumber, rating, feedback, tags, photos, driverId } = body;

        const deliveryRating = await prisma.deliveryRating.create({
          data: {
            consumerId,
            awbNumber,
            overallRating: rating.overall,
            deliverySpeedRating: rating.speed,
            packagingRating: rating.packaging,
            driverRating: rating.driver,
            feedbackText: feedback,
            feedbackTags: tags ? JSON.stringify(tags) : null,
            feedbackPhotos: photos ? JSON.stringify(photos) : null,
            driverId,
          },
        });

        return NextResponse.json({ success: true, data: deliveryRating });
      }

      case "REQUEST_RESCHEDULE": {
        const { awbNumber, newDate, newTimeSlot, reason } = body;

        // In production, this would create an NDR or reschedule request
        // For now, just log the request

        return NextResponse.json({
          success: true,
          data: {
            message: "Reschedule request submitted",
            newDate,
            newTimeSlot,
            requestId: `RSC${Date.now().toString(36).toUpperCase()}`,
          },
        });
      }

      case "REQUEST_CALLBACK": {
        const { awbNumber, phone, preferredTime, issue } = body;

        // In production, this would create a callback request in CRM

        return NextResponse.json({
          success: true,
          data: {
            message: "Callback request submitted",
            requestId: `CBK${Date.now().toString(36).toUpperCase()}`,
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in consumer tracking API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
