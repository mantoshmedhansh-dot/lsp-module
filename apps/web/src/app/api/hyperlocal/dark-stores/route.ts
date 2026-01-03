import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Dark Store Management API
// For hyperlocal 15-min to same-day delivery operations

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get("city");
    const pincode = searchParams.get("pincode");
    const latitude = searchParams.get("lat");
    const longitude = searchParams.get("lng");

    const where: any = { isActive: true };
    if (city) where.city = city;
    if (pincode) {
      // Check if pincode is in service area
      where.servicePincodes = { contains: pincode };
    }

    const darkStores = await prisma.darkStore.findMany({
      where,
      include: {
        _count: {
          select: {
            hyperlocalOrders: true,
            riders: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // If lat/lng provided, calculate distance and sort by nearest
    let sortedStores = darkStores;
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      sortedStores = darkStores
        .map((store) => ({
          ...store,
          distance: calculateDistance(lat, lng, store.latitude, store.longitude),
        }))
        .filter((store) => store.distance <= store.serviceRadiusKm)
        .sort((a, b) => a.distance - b.distance);
    }

    // Summary stats
    const summary = {
      totalStores: darkStores.length,
      activeRiders: await prisma.hyperlocalRider.count({
        where: { status: "ONLINE", isActive: true },
      }),
      todayOrders: await prisma.hyperlocalOrder.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      pendingOrders: await prisma.hyperlocalOrder.count({
        where: { status: { in: ["PENDING", "CONFIRMED", "PICKING"] } },
      }),
    };

    return NextResponse.json({
      success: true,
      data: {
        items: sortedStores,
        summary,
      },
    });
  } catch (error) {
    console.error("Error fetching dark stores:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dark stores" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const darkStore = await prisma.darkStore.create({
      data: {
        code: body.code,
        name: body.name,
        type: body.type || "DARK_STORE",
        address: body.address,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        latitude: body.latitude,
        longitude: body.longitude,
        servicePincodes: JSON.stringify(body.servicePincodes || []),
        serviceRadiusKm: body.serviceRadiusKm || 5,
        maxOrdersPerHour: body.maxOrdersPerHour || 50,
        maxDailyOrders: body.maxDailyOrders || 500,
        storageCapacitySqFt: body.storageCapacitySqFt || 0,
        openTime: body.openTime || "06:00",
        closeTime: body.closeTime || "23:00",
        operatingDays: body.operatingDays || "MON,TUE,WED,THU,FRI,SAT,SUN",
        managerName: body.managerName,
        managerPhone: body.managerPhone,
      },
    });

    return NextResponse.json({ success: true, data: darkStore });
  } catch (error) {
    console.error("Error creating dark store:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create dark store" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (updates.servicePincodes) {
      updates.servicePincodes = JSON.stringify(updates.servicePincodes);
    }

    const darkStore = await prisma.darkStore.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: darkStore });
  } catch (error) {
    console.error("Error updating dark store:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update dark store" },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
