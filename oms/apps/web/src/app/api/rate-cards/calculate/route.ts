import { NextRequest, NextResponse } from "next/server";
import { prisma, PaymentMode } from "@oms/database";
import { auth } from "@/lib/auth";

interface RateCalculation {
  transporterId: string;
  transporterName: string;
  baseRate: number;
  weightCharge: number;
  fuelSurcharge: number;
  codCharge: number;
  totalRate: number;
  estimatedDays?: number;
  rateCardId: string;
  rateCardName: string;
}

// POST /api/rate-cards/calculate - Calculate shipping rates
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      weight,
      originPincode,
      destinationPincode,
      paymentMode,
      orderValue,
      transporterIds,
    } = body;

    if (!weight || !destinationPincode) {
      return NextResponse.json(
        { error: "Weight and destination pincode are required" },
        { status: 400 }
      );
    }

    // Determine zone based on pincodes (simplified zone logic)
    const zone = getZoneFromPincodes(originPincode, destinationPincode);

    // Build query for active rate cards
    const rateCardWhere: Record<string, unknown> = {
      status: "ACTIVE",
      effectiveFrom: { lte: new Date() },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date() } },
      ],
    };

    // Filter by specific transporters if provided
    if (transporterIds && transporterIds.length > 0) {
      rateCardWhere.transporterId = { in: transporterIds };
    }

    // Get applicable rate cards with slabs
    const rateCards = await prisma.rateCard.findMany({
      where: rateCardWhere,
      include: {
        RateCardSlab: {
          orderBy: { fromWeight: "asc" },
        },
      },
    });

    // Get transporter info separately
    const transporterIds2 = [...new Set(rateCards.map(rc => rc.transporterId))];
    const transporters = await prisma.transporter.findMany({
      where: { id: { in: transporterIds2 } },
      select: { id: true, name: true, code: true },
    });
    const transporterMap = new Map(transporters.map(t => [t.id, t]));

    if (rateCards.length === 0) {
      return NextResponse.json({
        rates: [],
        message: "No applicable rate cards found",
      });
    }

    // Calculate rates for each rate card
    const calculations: RateCalculation[] = [];

    for (const rateCard of rateCards) {
      const transporter = transporterMap.get(rateCard.transporterId);
      if (!transporter) continue;

      const calculation = calculateRate(
        rateCard,
        weight,
        paymentMode as PaymentMode,
        orderValue
      );

      if (calculation) {
        calculations.push({
          transporterId: transporter.id,
          transporterName: transporter.name,
          rateCardId: rateCard.id,
          rateCardName: rateCard.name,
          ...calculation,
        });
      }
    }

    // Sort by total rate
    calculations.sort((a, b) => a.totalRate - b.totalRate);

    return NextResponse.json({
      rates: calculations,
      input: {
        weight,
        originPincode,
        destinationPincode,
        zone,
        paymentMode,
        orderValue,
      },
    });
  } catch (error) {
    console.error("Error calculating rates:", error);
    return NextResponse.json(
      { error: "Failed to calculate rates" },
      { status: 500 }
    );
  }
}

function getZoneFromPincodes(origin?: string, destination?: string): string {
  if (!origin || !destination) return "";

  // Simplified zone logic based on first 2 digits of pincode
  const originPrefix = origin.substring(0, 2);
  const destPrefix = destination.substring(0, 2);

  // Same city/region
  if (originPrefix === destPrefix) {
    return "LOCAL";
  }

  // Same state (simplified)
  const originState = getStateFromPrefix(originPrefix);
  const destState = getStateFromPrefix(destPrefix);

  if (originState === destState) {
    return "REGIONAL";
  }

  // Metro to metro
  const metroStates = ["11", "40", "56", "60", "70"]; // Delhi, Mumbai, Bangalore, Chennai, Kolkata
  if (metroStates.includes(originPrefix) && metroStates.includes(destPrefix)) {
    return "METRO";
  }

  // Rest of India
  return "NATIONAL";
}

function getStateFromPrefix(prefix: string): string {
  const stateMap: Record<string, string> = {
    "11": "DELHI", "12": "HARYANA", "13": "HARYANA", "14": "PUNJAB", "15": "PUNJAB",
    "20": "UP", "21": "UP", "22": "UP", "23": "UP", "24": "UP", "25": "UP", "26": "UP", "27": "UP", "28": "UP",
    "30": "RAJASTHAN", "31": "RAJASTHAN", "32": "RAJASTHAN", "33": "RAJASTHAN", "34": "RAJASTHAN",
    "36": "GUJARAT", "37": "GUJARAT", "38": "GUJARAT", "39": "GUJARAT",
    "40": "MAHARASHTRA", "41": "MAHARASHTRA", "42": "MAHARASHTRA", "43": "MAHARASHTRA", "44": "MAHARASHTRA",
    "45": "MP", "46": "MP", "47": "MP", "48": "MP", "49": "CHHATTISGARH",
    "50": "TELANGANA", "51": "TELANGANA", "52": "AP", "53": "AP",
    "56": "KARNATAKA", "57": "KARNATAKA", "58": "KARNATAKA", "59": "KARNATAKA",
    "60": "TAMILNADU", "62": "TAMILNADU", "63": "TAMILNADU", "64": "TAMILNADU",
    "67": "KERALA", "68": "KERALA", "69": "KERALA",
    "70": "WESTBENGAL", "71": "WESTBENGAL", "72": "WESTBENGAL", "73": "WESTBENGAL", "74": "WESTBENGAL",
    "75": "ODISHA", "76": "ODISHA", "77": "ODISHA",
    "78": "ASSAM", "79": "NORTHEAST",
    "80": "BIHAR", "81": "BIHAR", "82": "BIHAR", "84": "BIHAR",
    "83": "JHARKHAND", "85": "JHARKHAND", "86": "JHARKHAND",
  };

  return stateMap[prefix] || "OTHER";
}

interface RateCardData {
  baseCost: { toNumber(): number };
  fuelSurcharge: { toNumber(): number } | null;
  codChargesPercent: { toNumber(): number } | null;
  codChargesMin: { toNumber(): number } | null;
  RateCardSlab: {
    fromWeight: { toNumber(): number };
    toWeight: { toNumber(): number };
    rate: { toNumber(): number };
    additionalWeightRate: { toNumber(): number } | null;
  }[];
}

function calculateRate(
  rateCard: RateCardData,
  weight: number,
  paymentMode?: PaymentMode,
  orderValue?: number
): { baseRate: number; weightCharge: number; fuelSurcharge: number; codCharge: number; totalRate: number } | null {
  let baseRate = 0;
  let weightCharge = 0;

  // Check if using slab-based pricing
  if (rateCard.RateCardSlab && rateCard.RateCardSlab.length > 0) {
    // Find applicable slab
    const applicableSlab = rateCard.RateCardSlab.find(
      (slab) => weight >= slab.fromWeight.toNumber() && weight <= slab.toWeight.toNumber()
    );

    if (applicableSlab) {
      baseRate = applicableSlab.rate.toNumber();
      const additionalWeightRate = applicableSlab.additionalWeightRate?.toNumber() || 0;
      const slabFromWeight = applicableSlab.fromWeight.toNumber();

      if (weight > slabFromWeight && additionalWeightRate > 0) {
        weightCharge = Math.ceil(weight - slabFromWeight) * additionalWeightRate;
      }
    } else {
      // Use last slab for overflow
      const lastSlab = rateCard.RateCardSlab[rateCard.RateCardSlab.length - 1];
      baseRate = lastSlab.rate.toNumber();
      const additionalWeightRate = lastSlab.additionalWeightRate?.toNumber() || 0;
      const slabToWeight = lastSlab.toWeight.toNumber();

      if (weight > slabToWeight && additionalWeightRate > 0) {
        weightCharge = Math.ceil(weight - slabToWeight) * additionalWeightRate;
      }
    }
  } else {
    // Use base cost
    baseRate = rateCard.baseCost.toNumber();
  }

  // Calculate fuel surcharge
  const fuelSurchargePercent = rateCard.fuelSurcharge?.toNumber() || 0;
  const subtotal = baseRate + weightCharge;
  const fuelSurcharge = (subtotal * fuelSurchargePercent) / 100;

  // Calculate COD charge
  let codCharge = 0;
  if (paymentMode === "COD" && orderValue) {
    const codPercentage = rateCard.codChargesPercent?.toNumber() || 0;
    const codMinCharge = rateCard.codChargesMin?.toNumber() || 0;
    codCharge = Math.max((orderValue * codPercentage) / 100, codMinCharge);
  }

  const totalRate = baseRate + weightCharge + fuelSurcharge + codCharge;

  return {
    baseRate,
    weightCharge,
    fuelSurcharge,
    codCharge,
    totalRate: Math.round(totalRate * 100) / 100,
  };
}
