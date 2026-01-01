import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Zone mapping based on state
const STATE_ZONE_MAP: Record<string, string> = {
  // NORTH
  "DELHI": "NORTH",
  "HARYANA": "NORTH",
  "PUNJAB": "NORTH",
  "HIMACHAL PRADESH": "NORTH",
  "UTTARAKHAND": "NORTH",
  "JAMMU AND KASHMIR": "NORTH",
  "LADAKH": "NORTH",
  "UTTAR PRADESH": "NORTH",
  "CHANDIGARH": "NORTH",
  // SOUTH
  "KARNATAKA": "SOUTH",
  "TAMIL NADU": "SOUTH",
  "KERALA": "SOUTH",
  "ANDHRA PRADESH": "SOUTH",
  "TELANGANA": "SOUTH",
  "PUDUCHERRY": "SOUTH",
  // EAST
  "WEST BENGAL": "EAST",
  "ODISHA": "EAST",
  "BIHAR": "EAST",
  "JHARKHAND": "EAST",
  "ASSAM": "EAST",
  "TRIPURA": "EAST",
  "MEGHALAYA": "EAST",
  "MANIPUR": "EAST",
  "MIZORAM": "EAST",
  "NAGALAND": "EAST",
  "ARUNACHAL PRADESH": "EAST",
  "SIKKIM": "EAST",
  // WEST
  "MAHARASHTRA": "WEST",
  "GUJARAT": "WEST",
  "RAJASTHAN": "WEST",
  "GOA": "WEST",
  "DAMAN AND DIU": "WEST",
  "DADRA AND NAGAR HAVELI": "WEST",
  // CENTRAL
  "MADHYA PRADESH": "CENTRAL",
  "CHHATTISGARH": "CENTRAL",
};

// Default TAT matrix (used when no DB entry exists)
const DEFAULT_TAT_MATRIX: Record<string, Record<string, { local: number; zonal: number; national: number }>> = {
  EXPRESS: {
    LOCAL: { local: 1, zonal: 2, national: 3 },
    ZONAL: { local: 2, zonal: 3, national: 4 },
    NATIONAL: { local: 3, zonal: 4, national: 5 },
  },
  STANDARD: {
    LOCAL: { local: 2, zonal: 3, national: 5 },
    ZONAL: { local: 3, zonal: 4, national: 6 },
    NATIONAL: { local: 5, zonal: 6, national: 8 },
  },
  ECONOMY: {
    LOCAL: { local: 3, zonal: 5, national: 7 },
    ZONAL: { local: 5, zonal: 6, national: 8 },
    NATIONAL: { local: 7, zonal: 8, national: 10 },
  },
};

// Default rates per kg
const DEFAULT_RATES: Record<string, Record<string, number>> = {
  EXPRESS: { LOCAL: 25, ZONAL: 35, NATIONAL: 50 },
  STANDARD: { LOCAL: 15, ZONAL: 22, NATIONAL: 35 },
  ECONOMY: { LOCAL: 10, ZONAL: 15, NATIONAL: 25 },
};

function getZoneFromState(state: string): string {
  return STATE_ZONE_MAP[state.toUpperCase()] || "CENTRAL";
}

function getRouteType(originZone: string, destZone: string, originState: string, destState: string): string {
  // Same state = LOCAL
  if (originState.toUpperCase() === destState.toUpperCase()) {
    return "LOCAL";
  }
  // Same zone = ZONAL
  if (originZone === destZone) {
    return "ZONAL";
  }
  // Different zones = NATIONAL
  return "NATIONAL";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originPincode, destinationPincode, weightKg, serviceType = "STANDARD" } = body;

    if (!originPincode || !destinationPincode) {
      return NextResponse.json(
        { success: false, error: "Origin and destination pincodes are required" },
        { status: 400 }
      );
    }

    // Get origin pincode info
    let originInfo = await prisma.pincodeMaster.findUnique({
      where: { pincode: originPincode },
    });

    // Get destination pincode info
    let destInfo = await prisma.pincodeMaster.findUnique({
      where: { pincode: destinationPincode },
    });

    // If not in master, try to determine from hub mappings or use defaults
    if (!originInfo) {
      const hubMapping = await prisma.hubPincodeMapping.findFirst({
        where: { pincode: originPincode },
        include: { hub: true },
      });
      if (hubMapping) {
        originInfo = {
          id: "",
          pincode: originPincode,
          city: hubMapping.hub.city,
          state: hubMapping.hub.state,
          region: null,
          zone: getZoneFromState(hubMapping.hub.state),
          tier: 2,
          isActive: true,
          createdAt: new Date(),
        };
      }
    }

    if (!destInfo) {
      const hubMapping = await prisma.hubPincodeMapping.findFirst({
        where: { pincode: destinationPincode },
        include: { hub: true },
      });
      if (hubMapping) {
        destInfo = {
          id: "",
          pincode: destinationPincode,
          city: hubMapping.hub.city,
          state: hubMapping.hub.state,
          region: null,
          zone: getZoneFromState(hubMapping.hub.state),
          tier: 2,
          isActive: true,
          createdAt: new Date(),
        };
      }
    }

    // Default to CENTRAL zone if we can't determine
    const originZone = originInfo?.zone || getZoneFromState(originInfo?.state || "") || "CENTRAL";
    const destZone = destInfo?.zone || getZoneFromState(destInfo?.state || "") || "CENTRAL";

    const originState = originInfo?.state || "";
    const destState = destInfo?.state || "";

    const routeType = getRouteType(originZone, destZone, originState, destState);

    // Try to get TAT from database
    let tatData = await prisma.zoneTatMatrix.findFirst({
      where: {
        originZone,
        destinationZone: destZone,
        serviceType: serviceType.toUpperCase(),
        isActive: true,
      },
    });

    let tatDays: number;
    let minDays: number;
    let maxDays: number;
    let ratePerKg: number;
    let slaPercentage: number;

    if (tatData) {
      tatDays = tatData.tatDays;
      minDays = tatData.minDays;
      maxDays = tatData.maxDays;
      ratePerKg = tatData.baseRatePerKg;
      slaPercentage = tatData.slaPercentage;
    } else {
      // Use default TAT matrix
      const service = serviceType.toUpperCase() as keyof typeof DEFAULT_TAT_MATRIX;
      const defaultTat = DEFAULT_TAT_MATRIX[service] || DEFAULT_TAT_MATRIX.STANDARD;
      const routeTat = defaultTat[routeType as keyof typeof defaultTat] || defaultTat.NATIONAL;

      tatDays = routeTat.zonal; // Use zonal as default
      minDays = routeTat.local;
      maxDays = routeTat.national;
      ratePerKg = DEFAULT_RATES[service]?.[routeType] || 25;
      slaPercentage = 95;
    }

    // Calculate expected delivery date (excluding Sundays)
    const expectedDeliveryDate = calculateDeliveryDate(new Date(), tatDays);

    // Calculate estimated cost
    const chargeableWeight = Math.max(weightKg || 10, 10); // Minimum 10 kg
    const estimatedCost = Math.round(ratePerKg * chargeableWeight);

    return NextResponse.json({
      success: true,
      data: {
        origin: {
          pincode: originPincode,
          city: originInfo?.city || "Unknown",
          state: originInfo?.state || "Unknown",
          zone: originZone,
          tier: originInfo?.tier || 2,
        },
        destination: {
          pincode: destinationPincode,
          city: destInfo?.city || "Unknown",
          state: destInfo?.state || "Unknown",
          zone: destZone,
          tier: destInfo?.tier || 2,
        },
        routeType,
        serviceType: serviceType.toUpperCase(),
        tat: {
          days: tatDays,
          minDays,
          maxDays,
          expectedDeliveryDate: expectedDeliveryDate.toISOString().split("T")[0],
          slaPercentage,
        },
        pricing: {
          ratePerKg,
          chargeableWeight,
          estimatedCost,
          minChargeableKg: 10,
        },
        isServiceable: true,
      },
    });
  } catch (error) {
    console.error("TAT calculation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate TAT" },
      { status: 500 }
    );
  }
}

function calculateDeliveryDate(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    // Skip Sundays
    if (result.getDay() !== 0) {
      daysAdded++;
    }
  }

  return result;
}

// GET endpoint to fetch all service options for a route
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originPincode = searchParams.get("origin");
  const destinationPincode = searchParams.get("destination");
  const weightKg = parseFloat(searchParams.get("weight") || "10");

  if (!originPincode || !destinationPincode) {
    return NextResponse.json(
      { success: false, error: "Origin and destination pincodes are required" },
      { status: 400 }
    );
  }

  // Get TAT for all service types
  const services = ["EXPRESS", "STANDARD", "ECONOMY"];
  const results = [];

  for (const serviceType of services) {
    const response = await fetch(new URL("/api/customer/tat", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originPincode, destinationPincode, weightKg, serviceType }),
    });
    const data = await response.json();
    if (data.success) {
      results.push(data.data);
    }
  }

  return NextResponse.json({
    success: true,
    data: results,
  });
}
