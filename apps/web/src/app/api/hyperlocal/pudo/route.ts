import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// PUDO (Pick-Up Drop-Off) Points API
// For locker, kirana store, and retail point integrations

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get("city");
    const pincode = searchParams.get("pincode");
    const type = searchParams.get("type");
    const latitude = searchParams.get("lat");
    const longitude = searchParams.get("lng");
    const radiusKm = parseFloat(searchParams.get("radius") || "5");

    const where: any = { isActive: true };
    if (city) where.city = city;
    if (pincode) where.pincode = pincode;
    if (type) where.type = type;

    let pudoPoints = await prisma.pUDOPoint.findMany({
      where,
      include: {
        _count: { select: { packages: true } },
      },
      orderBy: { name: "asc" },
    });

    // Filter by distance if lat/lng provided
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      pudoPoints = pudoPoints
        .map((point) => ({
          ...point,
          distance: calculateDistance(lat, lng, point.latitude, point.longitude),
        }))
        .filter((point) => (point as any).distance <= radiusKm)
        .sort((a, b) => (a as any).distance - (b as any).distance) as any;
    }

    // Summary by type
    const summary = {
      total: pudoPoints.length,
      stores: pudoPoints.filter((p) => p.type === "STORE").length,
      lockers: pudoPoints.filter((p) => p.type === "LOCKER").length,
      kirana: pudoPoints.filter((p) => p.type === "KIRANA").length,
      petrolPumps: pudoPoints.filter((p) => p.type === "PETROL_PUMP").length,
      metro: pudoPoints.filter((p) => p.type === "METRO_STATION").length,
    };

    return NextResponse.json({
      success: true,
      data: { items: pudoPoints, summary },
    });
  } catch (error) {
    console.error("Error fetching PUDO points:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch PUDO points" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CREATE_PUDO": {
        const code = `PUDO${Date.now().toString(36).toUpperCase()}`;

        const pudoPoint = await prisma.pUDOPoint.create({
          data: {
            code,
            name: body.name,
            type: body.type || "STORE",
            partnerName: body.partnerName,
            partnerType: body.partnerType || "INDEPENDENT",
            address: body.address,
            landmark: body.landmark,
            city: body.city,
            state: body.state,
            pincode: body.pincode,
            latitude: body.latitude,
            longitude: body.longitude,
            lockerCount: body.lockerCount || 0,
            maxHoldDays: body.maxHoldDays || 7,
            maxPackageWeight: body.maxPackageWeight || 25,
            maxPackagesPerDay: body.maxPackagesPerDay || 100,
            openTime: body.openTime || "09:00",
            closeTime: body.closeTime || "21:00",
            operatingDays: body.operatingDays || "MON,TUE,WED,THU,FRI,SAT,SUN",
            contactName: body.contactName,
            contactPhone: body.contactPhone,
            pickupFee: body.pickupFee || 0,
            dropoffFee: body.dropoffFee || 0,
            storageFeePday: body.storageFeePday || 0,
          },
        });

        return NextResponse.json({ success: true, data: pudoPoint });
      }

      case "REGISTER_PACKAGE": {
        const { pudoPointId, shipmentId, awbNumber, customerName, customerPhone, customerEmail, packageType } = body;

        // Generate access code for locker
        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Calculate expiry (default 7 days)
        const pudoPoint = await prisma.pUDOPoint.findUnique({ where: { id: pudoPointId } });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (pudoPoint?.maxHoldDays || 7));

        const package_ = await prisma.pUDOPackage.create({
          data: {
            pudoPointId,
            shipmentId,
            awbNumber,
            packageType: packageType || "DROPOFF",
            customerName,
            customerPhone,
            customerEmail,
            accessCode,
            expiresAt,
            status: "PENDING",
          },
        });

        // Update PUDO point package count
        await prisma.pUDOPoint.update({
          where: { id: pudoPointId },
          data: { packagesHeld: { increment: 1 } },
        });

        return NextResponse.json({ success: true, data: package_ });
      }

      case "PACKAGE_ARRIVED": {
        const { packageId, lockerNumber } = body;

        const package_ = await prisma.pUDOPackage.update({
          where: { id: packageId },
          data: {
            status: "READY",
            arrivedAt: new Date(),
            notifiedAt: new Date(),
            lockerNumber,
          },
        });

        // TODO: Send notification to customer with access code

        return NextResponse.json({ success: true, data: package_ });
      }

      case "PACKAGE_COLLECTED": {
        const { packageId, verificationMethod } = body;

        const package_ = await prisma.pUDOPackage.update({
          where: { id: packageId },
          data: {
            status: "COLLECTED",
            collectedAt: new Date(),
          },
        });

        // Calculate storage charges if any
        if (package_.arrivedAt) {
          const storageDays = Math.ceil(
            (Date.now() - new Date(package_.arrivedAt).getTime()) / (1000 * 60 * 60 * 24)
          );

          const pudoPoint = await prisma.pUDOPoint.findUnique({
            where: { id: package_.pudoPointId },
          });

          if (storageDays > 2 && pudoPoint) {
            // Charge storage after 2 free days
            const chargeableDays = storageDays - 2;
            await prisma.pUDOPackage.update({
              where: { id: packageId },
              data: {
                storageDays: chargeableDays,
                storageCharge: chargeableDays * pudoPoint.storageFeePday,
              },
            });
          }
        }

        // Update PUDO point stats
        await prisma.pUDOPoint.update({
          where: { id: package_.pudoPointId },
          data: {
            packagesHeld: { decrement: 1 },
            successfulPickups: { increment: 1 },
          },
        });

        return NextResponse.json({ success: true, data: package_ });
      }

      case "GET_PACKAGES": {
        const { pudoPointId, status, awbNumber, customerPhone } = body;

        const where: any = {};
        if (pudoPointId) where.pudoPointId = pudoPointId;
        if (status) where.status = status;
        if (awbNumber) where.awbNumber = awbNumber;
        if (customerPhone) where.customerPhone = customerPhone;

        const packages = await prisma.pUDOPackage.findMany({
          where,
          include: {
            pudoPoint: { select: { code: true, name: true, address: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ success: true, data: packages });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in PUDO API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
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
