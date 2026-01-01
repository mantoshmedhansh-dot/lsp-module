import { prisma } from "@cjdquick/database";

export interface TransitTimeResult {
  avgTransitMinutes: number;
  stdDevMinutes: number;
  percentile90: number;
  onTimePercentage: number;
  sampleCount: number;
  source: "historical" | "estimated";
}

// Default transit times by route type (in minutes)
const DEFAULT_TRANSIT_TIMES = {
  LOCAL: {
    avg: 24 * 60, // 1 day
    stdDev: 4 * 60, // 4 hours
    onTime: 95,
  },
  ZONAL: {
    avg: 48 * 60, // 2 days
    stdDev: 8 * 60, // 8 hours
    onTime: 90,
  },
  NATIONAL: {
    avg: 96 * 60, // 4 days
    stdDev: 16 * 60, // 16 hours
    onTime: 85,
  },
};

// State to zone mapping for India
const STATE_ZONES: Record<string, string> = {
  // NORTH
  DL: "NORTH", // Delhi
  HR: "NORTH", // Haryana
  PB: "NORTH", // Punjab
  HP: "NORTH", // Himachal Pradesh
  UK: "NORTH", // Uttarakhand
  JK: "NORTH", // Jammu & Kashmir
  UP: "NORTH", // Uttar Pradesh
  CH: "NORTH", // Chandigarh

  // SOUTH
  KA: "SOUTH", // Karnataka
  TN: "SOUTH", // Tamil Nadu
  KL: "SOUTH", // Kerala
  AP: "SOUTH", // Andhra Pradesh
  TG: "SOUTH", // Telangana
  PY: "SOUTH", // Puducherry

  // EAST
  WB: "EAST", // West Bengal
  OR: "EAST", // Odisha
  BR: "EAST", // Bihar
  JH: "EAST", // Jharkhand
  AS: "EAST", // Assam
  SK: "EAST", // Sikkim
  AR: "EAST", // Arunachal Pradesh
  NL: "EAST", // Nagaland
  MN: "EAST", // Manipur
  MZ: "EAST", // Mizoram
  TR: "EAST", // Tripura
  ML: "EAST", // Meghalaya

  // WEST
  MH: "WEST", // Maharashtra
  GJ: "WEST", // Gujarat
  RJ: "WEST", // Rajasthan
  GA: "WEST", // Goa
  DD: "WEST", // Daman & Diu
  DN: "WEST", // Dadra & Nagar Haveli

  // CENTRAL
  MP: "CENTRAL", // Madhya Pradesh
  CG: "CENTRAL", // Chhattisgarh
};

/**
 * Calculate transit time for a route based on historical data or estimates
 */
export async function calculateTransitTime(
  originPincode: string,
  destinationPincode: string
): Promise<TransitTimeResult> {
  // Try to get historical data first
  const historicalData = await getHistoricalTransitTime(
    originPincode,
    destinationPincode
  );

  if (historicalData) {
    return {
      ...historicalData,
      source: "historical",
    };
  }

  // Fall back to estimation based on pincode patterns
  const routeType = determineRouteType(originPincode, destinationPincode);
  const defaults = DEFAULT_TRANSIT_TIMES[routeType];

  return {
    avgTransitMinutes: defaults.avg,
    stdDevMinutes: defaults.stdDev,
    percentile90: defaults.avg + defaults.stdDev * 1.3,
    onTimePercentage: defaults.onTime,
    sampleCount: 0,
    source: "estimated",
  };
}

/**
 * Get historical transit time from database
 */
async function getHistoricalTransitTime(
  originPincode: string,
  destinationPincode: string
): Promise<Omit<TransitTimeResult, "source"> | null> {
  // Look for exact match first
  const exactMatch = await prisma.historicalTransitTime.findFirst({
    where: {
      originPincode,
      destinationPincode,
    },
    orderBy: {
      periodStart: "desc",
    },
  });

  if (exactMatch) {
    return {
      avgTransitMinutes: exactMatch.avgTransitMinutes,
      stdDevMinutes: exactMatch.stdDevMinutes,
      percentile90: exactMatch.percentile90,
      onTimePercentage: exactMatch.onTimePercentage,
      sampleCount: exactMatch.sampleCount,
    };
  }

  // Try to find by pincode prefix (first 3 digits = region)
  const originPrefix = originPincode.substring(0, 3);
  const destPrefix = destinationPincode.substring(0, 3);

  const regionMatch = await prisma.historicalTransitTime.findFirst({
    where: {
      originPincode: { startsWith: originPrefix },
      destinationPincode: { startsWith: destPrefix },
    },
    orderBy: {
      sampleCount: "desc",
    },
  });

  if (regionMatch && regionMatch.sampleCount >= 10) {
    return {
      avgTransitMinutes: regionMatch.avgTransitMinutes,
      stdDevMinutes: regionMatch.stdDevMinutes,
      percentile90: regionMatch.percentile90,
      onTimePercentage: regionMatch.onTimePercentage,
      sampleCount: regionMatch.sampleCount,
    };
  }

  return null;
}

/**
 * Determine route type based on pincode analysis
 */
function determineRouteType(
  originPincode: string,
  destinationPincode: string
): "LOCAL" | "ZONAL" | "NATIONAL" {
  // Get state codes from pincodes (first digit indicates postal region)
  const originState = getStateFromPincode(originPincode);
  const destState = getStateFromPincode(destinationPincode);

  // Same state = LOCAL
  if (originState === destState) {
    return "LOCAL";
  }

  // Same zone = ZONAL
  const originZone = STATE_ZONES[originState] || "CENTRAL";
  const destZone = STATE_ZONES[destState] || "CENTRAL";

  if (originZone === destZone) {
    return "ZONAL";
  }

  // Different zones = NATIONAL
  return "NATIONAL";
}

/**
 * Get state code from pincode
 */
function getStateFromPincode(pincode: string): string {
  // Indian pincode first digit indicates postal region
  const firstDigit = pincode[0];
  const firstTwo = pincode.substring(0, 2);

  // Mapping based on Indian postal system
  const pincodeToState: Record<string, string> = {
    // North
    "11": "DL",
    "12": "HR",
    "13": "HR",
    "14": "PB",
    "15": "PB",
    "16": "CH",
    "17": "HP",
    "18": "JK",
    "19": "JK",
    "20": "UP",
    "21": "UP",
    "22": "UP",
    "23": "UP",
    "24": "UP",
    "25": "UP",
    "26": "UK",
    "27": "UP",
    "28": "UP",
    // East
    "70": "WB",
    "71": "WB",
    "72": "WB",
    "73": "WB",
    "74": "WB",
    "75": "OR",
    "76": "OR",
    "77": "OR",
    "78": "AS",
    "79": "AR",
    "80": "BR",
    "81": "BR",
    "82": "BR",
    "83": "JH",
    "84": "JH",
    "85": "JH",
    // West
    "30": "RJ",
    "31": "RJ",
    "32": "RJ",
    "33": "RJ",
    "34": "RJ",
    "36": "GJ",
    "37": "GJ",
    "38": "GJ",
    "39": "GJ",
    "40": "MH",
    "41": "MH",
    "42": "MH",
    "43": "MH",
    "44": "MH",
    "45": "MP",
    // South
    "50": "TG",
    "51": "TG",
    "52": "AP",
    "53": "AP",
    "56": "KA",
    "57": "KA",
    "58": "KA",
    "59": "KA",
    "60": "TN",
    "61": "TN",
    "62": "TN",
    "63": "TN",
    "64": "TN",
    "67": "KL",
    "68": "KL",
    "69": "KL",
    // Central
    "46": "MP",
    "47": "MP",
    "48": "MP",
    "49": "CG",
  };

  return pincodeToState[firstTwo] || "MH"; // Default to Maharashtra
}

/**
 * Aggregate and store historical transit time data
 * This should be run as a daily job
 */
export async function aggregateHistoricalTransitTimes(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get delivered shipments from last 30 days
  const deliveredShipments = await prisma.shipment.findMany({
    where: {
      status: "DELIVERED",
      updatedAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      id: true,
      shipperPincode: true,
      consigneePincode: true,
      expectedDeliveryDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Group by origin-destination pincode pairs
  const routeData = new Map<
    string,
    {
      transitTimes: number[];
      onTimeCount: number;
      totalCount: number;
    }
  >();

  for (const shipment of deliveredShipments) {
    const key = `${shipment.shipperPincode}-${shipment.consigneePincode}`;
    const transitMinutes =
      (shipment.updatedAt.getTime() - shipment.createdAt.getTime()) /
      (1000 * 60);

    if (!routeData.has(key)) {
      routeData.set(key, {
        transitTimes: [],
        onTimeCount: 0,
        totalCount: 0,
      });
    }

    const data = routeData.get(key)!;
    data.transitTimes.push(transitMinutes);
    data.totalCount++;

    if (
      shipment.expectedDeliveryDate &&
      shipment.updatedAt <= shipment.expectedDeliveryDate
    ) {
      data.onTimeCount++;
    }
  }

  // Calculate statistics and store
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);

  for (const [key, data] of routeData.entries()) {
    if (data.totalCount < 5) continue; // Skip routes with too few samples

    const [originPincode, destinationPincode] = key.split("-");
    const sorted = data.transitTimes.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const variance =
      sorted.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);
    const p90Index = Math.floor(sorted.length * 0.9);
    const percentile90 = sorted[p90Index] || sorted[sorted.length - 1];
    const onTimePercentage = (data.onTimeCount / data.totalCount) * 100;

    await prisma.historicalTransitTime.upsert({
      where: {
        originPincode_destinationPincode_periodStart: {
          originPincode,
          destinationPincode,
          periodStart,
        },
      },
      create: {
        originPincode,
        destinationPincode,
        sampleCount: data.totalCount,
        avgTransitMinutes: avg,
        medianTransitMinutes: sorted[Math.floor(sorted.length / 2)],
        stdDevMinutes: stdDev,
        percentile10: sorted[Math.floor(sorted.length * 0.1)] || sorted[0],
        percentile90,
        onTimePercentage,
        periodStart,
      },
      update: {
        sampleCount: data.totalCount,
        avgTransitMinutes: avg,
        medianTransitMinutes: sorted[Math.floor(sorted.length / 2)],
        stdDevMinutes: stdDev,
        percentile10: sorted[Math.floor(sorted.length * 0.1)] || sorted[0],
        percentile90,
        onTimePercentage,
      },
    });
  }
}
