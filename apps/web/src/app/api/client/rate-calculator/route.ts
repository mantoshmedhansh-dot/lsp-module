import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

export async function POST(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      originPincode,
      destinationPincode,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      paymentMode,
      codAmount,
    } = body;

    // Validate required fields
    if (!originPincode || !destinationPincode || !weightKg) {
      return NextResponse.json(
        { success: false, error: "Origin pincode, destination pincode and weight are required" },
        { status: 400 }
      );
    }

    // Calculate volumetric weight if dimensions provided
    let volumetricWeight = null;
    if (lengthCm && widthCm && heightCm) {
      volumetricWeight = (lengthCm * widthCm * heightCm) / 5000;
    }
    const chargeableWeight = volumetricWeight
      ? Math.max(weightKg, volumetricWeight)
      : weightKg;

    // Check serviceability and get rates
    const serviceability = await prisma.pincodeSLA.findFirst({
      where: {
        OR: [
          { originPincode, destinationPincode },
          { originPincode: destinationPincode, destinationPincode: originPincode },
        ],
        isActive: true,
      },
    });

    if (!serviceability) {
      return NextResponse.json({
        success: true,
        data: {
          serviceable: false,
          message: "This route is not serviceable",
        },
      });
    }

    // Calculate rates (simplified - in production would use rate cards)
    const baseRate = 40; // Base rate per shipment
    const perKgRate = chargeableWeight <= 0.5 ? 0 : (chargeableWeight - 0.5) * 15;
    const zoneMultiplier = serviceability.zone === "LOCAL" ? 1 :
                           serviceability.zone === "REGIONAL" ? 1.5 :
                           serviceability.zone === "NATIONAL" ? 2 : 2.5;

    const freightCharge = Math.round((baseRate + perKgRate) * zoneMultiplier);

    // COD charges
    let codCharge = 0;
    if (paymentMode === "COD" && codAmount) {
      codCharge = Math.max(30, Math.round(codAmount * 0.02)); // 2% or minimum 30
    }

    // Fuel surcharge (percentage)
    const fuelSurcharge = Math.round(freightCharge * 0.15);

    // GST
    const subtotal = freightCharge + codCharge + fuelSurcharge;
    const gst = Math.round(subtotal * 0.18);

    const total = subtotal + gst;

    return NextResponse.json({
      success: true,
      data: {
        serviceable: true,
        originPincode,
        destinationPincode,
        zone: serviceability.zone,
        estimatedDeliveryDays: serviceability.tatDays,
        weight: {
          actual: weightKg,
          volumetric: volumetricWeight,
          chargeable: chargeableWeight,
        },
        charges: {
          freightCharge,
          codCharge,
          fuelSurcharge,
          subtotal,
          gst,
          total,
        },
        paymentMode: paymentMode || "PREPAID",
      },
    });
  } catch (error) {
    console.error("Rate calculator error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
