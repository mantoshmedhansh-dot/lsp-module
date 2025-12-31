import { getPrisma } from "@cjdquick/database";
import type { PartnerOption, PartnerSelectionResult } from "@cjdquick/types";

interface SelectionParams {
  originPincode: string;
  destinationPincode: string;
  weightKg: number;
  isCod: boolean;
  codAmount: number;
  clientWeights: {
    cost: number;
    speed: number;
    reliability: number;
  };
}

export async function selectOptimalPartner(
  params: SelectionParams
): Promise<PartnerSelectionResult | null> {
  const prisma = await getPrisma();
  const {
    originPincode,
    destinationPincode,
    weightKg,
    isCod,
    codAmount,
    clientWeights,
  } = params;

  // 1. Get all serviceable partners for this route
  const serviceability = await prisma.partnerServiceability.findMany({
    where: {
      originPincode,
      destinationPincode,
      isActive: true,
      partner: {
        isActive: true,
        ...(isCod ? { supportsCod: true } : {}),
      },
    },
    include: {
      partner: {
        include: {
          performance: {
            orderBy: { calculationDate: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (serviceability.length === 0) {
    return null;
  }

  // 2. Calculate rates and scores for each partner
  const partnerOptions: PartnerOption[] = serviceability.map((s) => {
    // Calculate total rate
    const baseRate = Number(s.baseRate);
    const weightCharge = Number(s.ratePerKg) * weightKg;
    let codCharge = 0;

    if (isCod && codAmount > 0) {
      codCharge = Math.max(
        Number(s.codChargeMin),
        (Number(s.codChargePercent) / 100) * codAmount
      );
    }

    const totalRate = baseRate + weightCharge + codCharge;

    // Get reliability score from performance metrics
    const performance = s.partner.performance[0];
    const reliabilityScore = performance
      ? Number(performance.reliabilityScore)
      : 80; // Default score

    return {
      partnerId: s.partnerId,
      partnerCode: s.partner.code,
      partnerName: s.partner.displayName,
      rate: totalRate,
      estimatedTatDays: s.estimatedTatDays,
      reliabilityScore,
      finalScore: 0, // Will be calculated
      scores: {
        cost: 0,
        speed: 0,
        reliability: 0,
      },
    };
  });

  // 3. Normalize scores (0-100 scale)
  const rates = partnerOptions.map((p) => p.rate);
  const tats = partnerOptions.map((p) => p.estimatedTatDays);

  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const rateRange = maxRate - minRate || 1;

  const minTat = Math.min(...tats);
  const maxTat = Math.max(...tats);
  const tatRange = maxTat - minTat || 1;

  for (const partner of partnerOptions) {
    // Cost score: Lower cost = higher score
    partner.scores.cost = 100 * (1 - (partner.rate - minRate) / rateRange);

    // Speed score: Lower TAT = higher score
    partner.scores.speed =
      100 * (1 - (partner.estimatedTatDays - minTat) / tatRange);

    // Reliability score already on 0-100 scale
    partner.scores.reliability = partner.reliabilityScore;

    // Calculate final weighted score
    partner.finalScore =
      clientWeights.cost * partner.scores.cost +
      clientWeights.speed * partner.scores.speed +
      clientWeights.reliability * partner.scores.reliability;
  }

  // 4. Sort by final score (descending)
  partnerOptions.sort((a, b) => b.finalScore - a.finalScore);

  return {
    recommended: partnerOptions[0],
    alternatives: partnerOptions.slice(1),
  };
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CJD${timestamp}${random}`;
}

export function calculateVolumetricWeight(
  lengthCm: number,
  widthCm: number,
  heightCm: number
): number {
  // Standard volumetric divisor for courier: 5000
  return (lengthCm * widthCm * heightCm) / 5000;
}

export function calculateChargeableWeight(
  actualWeight: number,
  volumetricWeight: number
): number {
  return Math.max(actualWeight, volumetricWeight);
}
