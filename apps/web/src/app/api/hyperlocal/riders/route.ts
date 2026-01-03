import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Hyperlocal Rider Management API

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const darkStoreId = searchParams.get("darkStoreId");
    const status = searchParams.get("status");

    const where: any = { isActive: true };
    if (darkStoreId) where.darkStoreId = darkStoreId;
    if (status) where.status = status;

    const riders = await prisma.hyperlocalRider.findMany({
      where,
      include: {
        darkStore: { select: { code: true, name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { name: "asc" },
    });

    // Summary
    const summary = {
      total: riders.length,
      online: riders.filter((r) => r.status === "ONLINE").length,
      busy: riders.filter((r) => r.status === "BUSY").length,
      offline: riders.filter((r) => r.status === "OFFLINE").length,
      onBreak: riders.filter((r) => r.status === "ON_BREAK").length,
    };

    return NextResponse.json({
      success: true,
      data: { items: riders, summary },
    });
  } catch (error) {
    console.error("Error fetching riders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch riders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CREATE_RIDER": {
        const riderCode = `RDR${Date.now().toString(36).toUpperCase()}`;

        const rider = await prisma.hyperlocalRider.create({
          data: {
            riderCode,
            name: body.name,
            phone: body.phone,
            email: body.email,
            aadhaarNumber: body.aadhaarNumber,
            dlNumber: body.dlNumber,
            dlExpiry: body.dlExpiry ? new Date(body.dlExpiry) : null,
            vehicleType: body.vehicleType || "BIKE",
            vehicleNumber: body.vehicleNumber,
            vehicleModel: body.vehicleModel,
            darkStoreId: body.darkStoreId,
            shiftStart: body.shiftStart,
            shiftEnd: body.shiftEnd,
            basePay: body.basePay || 0,
            perDeliveryPay: body.perDeliveryPay || 0,
            bankAccountNumber: body.bankAccountNumber,
            bankIfsc: body.bankIfsc,
            bankAccountName: body.bankAccountName,
          },
        });

        return NextResponse.json({ success: true, data: rider });
      }

      case "UPDATE_STATUS": {
        const { riderId, status, latitude, longitude } = body;

        const rider = await prisma.hyperlocalRider.update({
          where: { id: riderId },
          data: {
            status,
            lastLocationLat: latitude,
            lastLocationLng: longitude,
            lastLocationTime: new Date(),
          },
        });

        // Log location
        if (latitude && longitude) {
          await prisma.riderLocationHistory.create({
            data: {
              riderId,
              latitude,
              longitude,
              status,
            },
          });
        }

        return NextResponse.json({ success: true, data: rider });
      }

      case "UPDATE_LOCATION": {
        const { riderId, latitude, longitude, accuracy, speed, heading, batteryLevel, orderId } = body;

        await prisma.hyperlocalRider.update({
          where: { id: riderId },
          data: {
            lastLocationLat: latitude,
            lastLocationLng: longitude,
            lastLocationTime: new Date(),
          },
        });

        const location = await prisma.riderLocationHistory.create({
          data: {
            riderId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            batteryLevel,
            orderId,
          },
        });

        return NextResponse.json({ success: true, data: location });
      }

      case "GET_LOCATION_HISTORY": {
        const { riderId, fromTime, toTime, orderId } = body;

        const where: any = { riderId };
        if (fromTime) where.timestamp = { gte: new Date(fromTime) };
        if (toTime) where.timestamp = { ...where.timestamp, lte: new Date(toTime) };
        if (orderId) where.orderId = orderId;

        const locations = await prisma.riderLocationHistory.findMany({
          where,
          orderBy: { timestamp: "asc" },
          take: 1000,
        });

        return NextResponse.json({ success: true, data: locations });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in rider API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    const rider = await prisma.hyperlocalRider.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: rider });
  } catch (error) {
    console.error("Error updating rider:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update rider" },
      { status: 500 }
    );
  }
}
