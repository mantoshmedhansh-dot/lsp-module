/**
 * Intelligent Order Orchestration Service
 *
 * Handles intelligent business logic for:
 * - Multi-warehouse inventory allocation with hopping
 * - SLA calculation and tracking
 * - Partner selection integration
 * - Picklist optimization strategies
 * - Pincode serviceability validation
 * - Last-mile serviceability checks
 */

import { prisma } from "@cjdquick/database";
import { selectOptimalPartner } from "./partner-selection";

// =============================================================================
// PINCODE SERVICEABILITY TYPES
// =============================================================================

export interface ServiceabilityCheckResult {
  pincode: string;
  isServiceable: boolean;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  deliveryDays: number | null;
  zone: string | null;
  hub: {
    code: string;
    name: string;
    city: string;
  } | null;
  serviceablePartners: string[];
  lastMileAvailable: boolean;
  restrictions?: string[];
}

export interface RouteServiceabilityResult {
  originPincode: string;
  destinationPincode: string;
  isServiceable: boolean;
  serviceablePartners: {
    partnerId: string;
    partnerCode: string;
    codAvailable: boolean;
    estimatedTatDays: number;
  }[];
  routeType: string;
  estimatedTatDays: number;
  lastMileServiceable: boolean;
  restrictions: string[];
}

// =============================================================================
// TYPES
// =============================================================================

export interface WarehouseAllocationConfig {
  enableHopping: boolean;
  maxHops: number;
  priorityOrder: "NEAREST_FIRST" | "COST_FIRST" | "SLA_FIRST";
  splitOrderAllowed: boolean;
}

export interface AllocationRequest {
  orderId: string;
  items: {
    skuId: string;
    skuCode: string;
    quantity: number;
  }[];
  destinationPincode: string;
  preferredWarehouseId?: string;
  config?: Partial<WarehouseAllocationConfig>;
}

export interface WarehouseInventory {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  pincode: string;
  availableQty: number;
  reservedQty: number;
  distanceKm?: number;
  estimatedTatDays?: number;
}

export interface AllocationDecision {
  orderId: string;
  success: boolean;
  strategy: string;
  allocations: {
    skuId: string;
    skuCode: string;
    requiredQty: number;
    warehouses: {
      warehouseId: string;
      warehouseCode: string;
      allocatedQty: number;
      hopLevel: number;
      reason: string;
    }[];
    shortfall: number;
  }[];
  slaImpact: {
    originalEta: Date;
    adjustedEta?: Date;
    reason?: string;
  };
  totalHops: number;
  splitRequired: boolean;
}

export interface SLAConfig {
  orderType: "EXPRESS" | "STANDARD" | "ECONOMY";
  originPincode: string;
  destinationPincode: string;
  orderPlacedAt: Date;
}

export interface SLAResult {
  promisedDeliveryDate: Date;
  cutoffTime: Date;
  tatDays: number;
  slaType: string;
  isAchievable: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  milestones: {
    event: string;
    expectedBy: Date;
    criticality: "HIGH" | "MEDIUM" | "LOW";
  }[];
}

export interface PicklistStrategy {
  type: "WAVE" | "BATCH" | "ZONE" | "SINGLE_ORDER";
  config: {
    maxOrdersPerWave?: number;
    batchSize?: number;
    zoneGrouping?: boolean;
    priorityBased?: boolean;
  };
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

const DEFAULT_ALLOCATION_CONFIG: WarehouseAllocationConfig = {
  enableHopping: true,
  maxHops: 3,
  priorityOrder: "SLA_FIRST",
  splitOrderAllowed: true,
};

// TAT (Turn Around Time) matrix in days by zone type
const TAT_MATRIX: Record<string, Record<string, number>> = {
  METRO_TO_METRO: { EXPRESS: 1, STANDARD: 2, ECONOMY: 4 },
  METRO_TO_TIER1: { EXPRESS: 2, STANDARD: 3, ECONOMY: 5 },
  METRO_TO_TIER2: { EXPRESS: 3, STANDARD: 4, ECONOMY: 6 },
  METRO_TO_REMOTE: { EXPRESS: 4, STANDARD: 5, ECONOMY: 8 },
  TIER1_TO_METRO: { EXPRESS: 2, STANDARD: 3, ECONOMY: 5 },
  TIER1_TO_TIER1: { EXPRESS: 2, STANDARD: 3, ECONOMY: 5 },
  TIER1_TO_TIER2: { EXPRESS: 3, STANDARD: 4, ECONOMY: 6 },
  TIER1_TO_REMOTE: { EXPRESS: 4, STANDARD: 5, ECONOMY: 7 },
  DEFAULT: { EXPRESS: 3, STANDARD: 5, ECONOMY: 7 },
};

// Pincode zone classification (sample - in production this would be from database)
const ZONE_CLASSIFICATION: Record<string, string> = {
  "110": "METRO", // Delhi
  "400": "METRO", // Mumbai
  "560": "METRO", // Bangalore
  "600": "METRO", // Chennai
  "700": "METRO", // Kolkata
  "500": "TIER1", // Hyderabad
  "411": "TIER1", // Pune
  "380": "TIER1", // Ahmedabad
};

// =============================================================================
// PINCODE SERVICEABILITY CHECKS
// =============================================================================

/**
 * Check if a pincode is serviceable
 * Integrates with HubPincodeMapping and TransporterServicePincode tables
 */
export async function checkPincodeServiceability(
  pincode: string
): Promise<ServiceabilityCheckResult> {
  // Validate pincode format
  if (!/^\d{6}$/.test(pincode)) {
    return {
      pincode,
      isServiceable: false,
      codAvailable: false,
      prepaidAvailable: false,
      deliveryDays: null,
      zone: null,
      hub: null,
      serviceablePartners: [],
      lastMileAvailable: false,
      restrictions: ["Invalid pincode format"],
    };
  }

  try {
    // Check hub mapping for last-mile serviceability
    const hubMapping = await prisma.hubPincodeMapping.findFirst({
      where: { pincode },
      include: {
        hub: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
          },
        },
      },
    });

    // Check which transporters service this pincode
    const transporterServiceability = await prisma.transporterServicePincode.findMany({
      where: {
        pincode,
        transporter: { isActive: true },
      },
      include: {
        transporter: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Check pincode master for zone/tier info
    const pincodeMaster = await prisma.pincodeMaster.findUnique({
      where: { pincode },
    });

    const isServiceable = hubMapping !== null || transporterServiceability.length > 0;
    const lastMileAvailable = hubMapping !== null;

    // Aggregate COD/Prepaid availability across transporters
    const codAvailable = transporterServiceability.some(t => t.codAvailable);
    const prepaidAvailable = transporterServiceability.some(t => t.prepaidAvailable);

    // Get minimum delivery days
    const deliveryDays = transporterServiceability.length > 0
      ? Math.min(...transporterServiceability.filter(t => t.deliveryDays).map(t => t.deliveryDays!))
      : null;

    return {
      pincode,
      isServiceable,
      codAvailable: codAvailable || (hubMapping !== null), // If hub serves, assume COD available
      prepaidAvailable: prepaidAvailable || (hubMapping !== null),
      deliveryDays,
      zone: pincodeMaster?.zone || getZoneType(pincode),
      hub: hubMapping?.hub ? {
        code: hubMapping.hub.code,
        name: hubMapping.hub.name,
        city: hubMapping.hub.city,
      } : null,
      serviceablePartners: transporterServiceability.map(t => t.transporter.code),
      lastMileAvailable,
      restrictions: isServiceable ? [] : ["Pincode not serviceable"],
    };
  } catch (error) {
    // Database unavailable - fall back to zone-based estimation
    const zone = getZoneType(pincode);
    const isMetroOrTier1 = zone === "METRO" || zone === "TIER1";

    return {
      pincode,
      isServiceable: isMetroOrTier1, // Assume metros/tier1 are serviceable
      codAvailable: isMetroOrTier1,
      prepaidAvailable: true,
      deliveryDays: zone === "METRO" ? 2 : zone === "TIER1" ? 3 : 5,
      zone,
      hub: null,
      serviceablePartners: isMetroOrTier1 ? ["DELHIVERY", "BLUEDART", "ECOMEXP"] : ["DTDC"],
      lastMileAvailable: isMetroOrTier1,
      restrictions: ["Serviceability estimated - database unavailable"],
    };
  }
}

/**
 * Check route serviceability between origin and destination
 * Returns list of partners who can service this route
 */
export async function checkRouteServiceability(
  originPincode: string,
  destinationPincode: string,
  paymentMode: "PREPAID" | "COD" = "PREPAID"
): Promise<RouteServiceabilityResult> {
  const restrictions: string[] = [];

  // Check both pincodes
  const [originCheck, destCheck] = await Promise.all([
    checkPincodeServiceability(originPincode),
    checkPincodeServiceability(destinationPincode),
  ]);

  if (!originCheck.isServiceable) {
    restrictions.push(`Origin pincode ${originPincode} not serviceable`);
  }
  if (!destCheck.isServiceable) {
    restrictions.push(`Destination pincode ${destinationPincode} not serviceable`);
  }
  if (paymentMode === "COD" && !destCheck.codAvailable) {
    restrictions.push(`COD not available for destination ${destinationPincode}`);
  }

  // Get route type
  const routeType = getRouteType(
    originCheck.zone || "REMOTE",
    destCheck.zone || "REMOTE"
  );

  // Get serviceable partners for this specific route
  let serviceablePartners: RouteServiceabilityResult["serviceablePartners"] = [];

  try {
    const partnerServiceability = await prisma.partnerServiceability.findMany({
      where: {
        originPincode,
        destinationPincode,
        isActive: true,
        partner: {
          isActive: true,
          ...(paymentMode === "COD" ? { supportsCod: true } : {}),
        },
      },
      include: {
        partner: {
          select: { id: true, code: true, displayName: true, supportsCod: true },
        },
      },
    });

    serviceablePartners = partnerServiceability.map(p => ({
      partnerId: p.partnerId,
      partnerCode: p.partner.code,
      codAvailable: p.partner.supportsCod,
      estimatedTatDays: p.estimatedTatDays,
    }));
  } catch {
    // Fallback when database unavailable
    const commonPartners = originCheck.serviceablePartners.filter(
      p => destCheck.serviceablePartners.includes(p)
    );

    serviceablePartners = commonPartners.map(code => ({
      partnerId: code.toLowerCase(),
      partnerCode: code,
      codAvailable: paymentMode !== "COD" || destCheck.codAvailable,
      estimatedTatDays: destCheck.deliveryDays || 5,
    }));
  }

  const isServiceable = serviceablePartners.length > 0 && restrictions.filter(
    r => !r.includes("database unavailable")
  ).length === 0;

  return {
    originPincode,
    destinationPincode,
    isServiceable,
    serviceablePartners,
    routeType,
    estimatedTatDays: serviceablePartners.length > 0
      ? Math.min(...serviceablePartners.map(p => p.estimatedTatDays))
      : 7,
    lastMileServiceable: destCheck.lastMileAvailable,
    restrictions,
  };
}

/**
 * Get route type between two zones
 */
function getRouteType(originZone: string, destinationZone: string): string {
  return `${originZone}_TO_${destinationZone}`;
}

/**
 * Validate order for serviceability before processing
 */
export async function validateOrderServiceability(
  originPincode: string,
  destinationPincode: string,
  paymentMode: "PREPAID" | "COD",
  weight: number,
  declaredValue?: number
): Promise<{
  isValid: boolean;
  routeServiceability: RouteServiceabilityResult;
  validationErrors: string[];
  warnings: string[];
}> {
  const validationErrors: string[] = [];
  const warnings: string[] = [];

  // Check route serviceability
  const routeServiceability = await checkRouteServiceability(
    originPincode,
    destinationPincode,
    paymentMode
  );

  if (!routeServiceability.isServiceable) {
    validationErrors.push(...routeServiceability.restrictions);
  }

  // Weight validation
  const MAX_WEIGHT = 30; // kg
  if (weight > MAX_WEIGHT) {
    validationErrors.push(`Weight ${weight}kg exceeds maximum limit of ${MAX_WEIGHT}kg`);
  }

  // COD value validation
  const MAX_COD_VALUE = 50000;
  if (paymentMode === "COD" && declaredValue && declaredValue > MAX_COD_VALUE) {
    validationErrors.push(`COD amount ₹${declaredValue} exceeds limit of ₹${MAX_COD_VALUE}`);
    warnings.push("Consider switching to PREPAID for high-value orders");
  }

  // Last-mile warning
  if (!routeServiceability.lastMileServiceable) {
    warnings.push("Last-mile delivery may have limited tracking visibility");
  }

  // Limited partner warning
  if (routeServiceability.serviceablePartners.length === 1) {
    warnings.push("Only one courier partner available for this route");
  }

  return {
    isValid: validationErrors.length === 0,
    routeServiceability,
    validationErrors,
    warnings,
  };
}

// =============================================================================
// MULTI-WAREHOUSE INVENTORY ALLOCATION WITH HOPPING
// =============================================================================

/**
 * Get inventory availability across all warehouses for given SKUs
 */
async function getMultiWarehouseInventory(
  skuIds: string[],
  destinationPincode: string
): Promise<Map<string, WarehouseInventory[]>> {
  const inventoryMap = new Map<string, WarehouseInventory[]>();

  // Get all warehouses with inventory for these SKUs
  const inventoryBatches = await prisma.inventoryBatch.findMany({
    where: {
      itemId: { in: skuIds },
      availableQty: { gt: 0 },
      status: "AVAILABLE",
    },
    include: {
      item: {
        select: { id: true, code: true },
      },
    },
  });

  // Get warehouse details
  const warehouseIds = [...new Set(inventoryBatches.map(b => b.locationId).filter(Boolean))];
  const warehouses = await prisma.location.findMany({
    where: {
      id: { in: warehouseIds as string[] },
      isActive: true,
    },
  });

  const warehouseMap = new Map(warehouses.map(w => [w.id, w]));

  // Group inventory by SKU
  for (const skuId of skuIds) {
    const skuBatches = inventoryBatches.filter(b => b.itemId === skuId);
    const warehouseInventories: WarehouseInventory[] = [];

    // Aggregate by warehouse
    const warehouseAggregates = new Map<string, number>();
    for (const batch of skuBatches) {
      if (batch.locationId) {
        const current = warehouseAggregates.get(batch.locationId) || 0;
        warehouseAggregates.set(batch.locationId, current + batch.availableQty);
      }
    }

    for (const [warehouseId, availableQty] of warehouseAggregates) {
      const warehouse = warehouseMap.get(warehouseId);
      if (warehouse) {
        // Calculate distance/TAT based on pincodes
        const estimatedTat = calculateEstimatedTAT(
          warehouse.pincode || "",
          destinationPincode,
          "STANDARD"
        );

        warehouseInventories.push({
          warehouseId,
          warehouseCode: warehouse.code,
          warehouseName: warehouse.name,
          pincode: warehouse.pincode || "",
          availableQty,
          reservedQty: 0,
          estimatedTatDays: estimatedTat,
        });
      }
    }

    // Sort by estimated TAT (nearest first for SLA optimization)
    warehouseInventories.sort((a, b) =>
      (a.estimatedTatDays || 99) - (b.estimatedTatDays || 99)
    );

    inventoryMap.set(skuId, warehouseInventories);
  }

  return inventoryMap;
}

/**
 * Allocate inventory with multi-warehouse hopping support
 */
export async function allocateWithHopping(
  request: AllocationRequest
): Promise<AllocationDecision> {
  const config = { ...DEFAULT_ALLOCATION_CONFIG, ...request.config };
  const { orderId, items, destinationPincode, preferredWarehouseId } = request;

  // Get inventory across all warehouses
  const skuIds = items.map(i => i.skuId);
  const inventoryMap = await getMultiWarehouseInventory(skuIds, destinationPincode);

  const allocations: AllocationDecision["allocations"] = [];
  let totalHops = 0;
  let splitRequired = false;
  let maxTatDays = 0;

  for (const item of items) {
    const warehouseInventories = inventoryMap.get(item.skuId) || [];
    let remainingQty = item.quantity;
    const warehouseAllocations: AllocationDecision["allocations"][0]["warehouses"] = [];
    let hopLevel = 0;

    // First try preferred warehouse if specified
    if (preferredWarehouseId && config.enableHopping) {
      const preferred = warehouseInventories.find(w => w.warehouseId === preferredWarehouseId);
      if (preferred && preferred.availableQty > 0) {
        const allocateQty = Math.min(remainingQty, preferred.availableQty);
        warehouseAllocations.push({
          warehouseId: preferred.warehouseId,
          warehouseCode: preferred.warehouseCode,
          allocatedQty: allocateQty,
          hopLevel: 0,
          reason: "Primary warehouse allocation",
        });
        remainingQty -= allocateQty;
        maxTatDays = Math.max(maxTatDays, preferred.estimatedTatDays || 0);
      }
    }

    // If still need more, hop to other warehouses
    if (remainingQty > 0 && config.enableHopping) {
      for (const warehouse of warehouseInventories) {
        if (remainingQty <= 0) break;
        if (hopLevel >= config.maxHops) break;
        if (warehouse.warehouseId === preferredWarehouseId) continue;

        const allocateQty = Math.min(remainingQty, warehouse.availableQty);
        if (allocateQty > 0) {
          hopLevel++;
          totalHops++;
          splitRequired = true;

          warehouseAllocations.push({
            warehouseId: warehouse.warehouseId,
            warehouseCode: warehouse.warehouseCode,
            allocatedQty: allocateQty,
            hopLevel,
            reason: `Hop ${hopLevel}: Inventory hopping from ${warehouse.warehouseCode}`,
          });
          remainingQty -= allocateQty;
          maxTatDays = Math.max(maxTatDays, warehouse.estimatedTatDays || 0);
        }
      }
    } else if (remainingQty > 0 && !config.enableHopping) {
      // No hopping - try only from preferred or first available warehouse
      const firstAvailable = warehouseInventories[0];
      if (firstAvailable && firstAvailable.availableQty > 0) {
        const allocateQty = Math.min(remainingQty, firstAvailable.availableQty);
        warehouseAllocations.push({
          warehouseId: firstAvailable.warehouseId,
          warehouseCode: firstAvailable.warehouseCode,
          allocatedQty: allocateQty,
          hopLevel: 0,
          reason: "Single warehouse allocation (hopping disabled)",
        });
        remainingQty -= allocateQty;
        maxTatDays = Math.max(maxTatDays, firstAvailable.estimatedTatDays || 0);
      }
    }

    allocations.push({
      skuId: item.skuId,
      skuCode: item.skuCode,
      requiredQty: item.quantity,
      warehouses: warehouseAllocations,
      shortfall: remainingQty,
    });
  }

  const hasShortfall = allocations.some(a => a.shortfall > 0);
  const originalEta = new Date();
  originalEta.setDate(originalEta.getDate() + maxTatDays);

  return {
    orderId,
    success: !hasShortfall,
    strategy: config.enableHopping
      ? `MULTI_WAREHOUSE_HOPPING (max ${config.maxHops} hops)`
      : "SINGLE_WAREHOUSE",
    allocations,
    slaImpact: {
      originalEta,
      adjustedEta: splitRequired ? new Date(originalEta.getTime() + 24 * 60 * 60 * 1000) : undefined,
      reason: splitRequired ? "Split shipment adds 1 day to delivery" : undefined,
    },
    totalHops,
    splitRequired,
  };
}

// =============================================================================
// SLA CALCULATION AND TRACKING
// =============================================================================

/**
 * Get zone type for a pincode
 */
function getZoneType(pincode: string): string {
  const prefix = pincode.substring(0, 3);
  return ZONE_CLASSIFICATION[prefix] || "REMOTE";
}

/**
 * Calculate estimated TAT in days
 */
function calculateEstimatedTAT(
  originPincode: string,
  destinationPincode: string,
  orderType: "EXPRESS" | "STANDARD" | "ECONOMY"
): number {
  const originZone = getZoneType(originPincode);
  const destinationZone = getZoneType(destinationPincode);
  const routeType = getRouteType(originZone, destinationZone);

  const tatMatrix = TAT_MATRIX[routeType] || TAT_MATRIX.DEFAULT;
  return tatMatrix[orderType] || 5;
}

/**
 * Calculate SLA for an order
 */
export function calculateSLA(config: SLAConfig): SLAResult {
  const { orderType, originPincode, destinationPincode, orderPlacedAt } = config;

  const tatDays = calculateEstimatedTAT(originPincode, destinationPincode, orderType);

  // Calculate cutoff time (usually 2 PM for same-day processing)
  const cutoffTime = new Date(orderPlacedAt);
  cutoffTime.setHours(14, 0, 0, 0);

  // If order placed after cutoff, add 1 day
  const effectiveStartDate = new Date(orderPlacedAt);
  if (orderPlacedAt > cutoffTime) {
    effectiveStartDate.setDate(effectiveStartDate.getDate() + 1);
  }

  // Calculate promised delivery date
  const promisedDeliveryDate = new Date(effectiveStartDate);
  promisedDeliveryDate.setDate(promisedDeliveryDate.getDate() + tatDays);

  // Define milestones
  const milestones: SLAResult["milestones"] = [];

  // Milestone 1: Allocation (within 2 hours)
  const allocationBy = new Date(orderPlacedAt);
  allocationBy.setHours(allocationBy.getHours() + 2);
  milestones.push({
    event: "INVENTORY_ALLOCATED",
    expectedBy: allocationBy,
    criticality: "HIGH",
  });

  // Milestone 2: Picking (within 4 hours of allocation)
  const pickingBy = new Date(allocationBy);
  pickingBy.setHours(pickingBy.getHours() + 4);
  milestones.push({
    event: "PICKING_COMPLETED",
    expectedBy: pickingBy,
    criticality: "HIGH",
  });

  // Milestone 3: Packing (within 2 hours of picking)
  const packingBy = new Date(pickingBy);
  packingBy.setHours(packingBy.getHours() + 2);
  milestones.push({
    event: "PACKING_COMPLETED",
    expectedBy: packingBy,
    criticality: "MEDIUM",
  });

  // Milestone 4: Dispatch (by end of day)
  const dispatchBy = new Date(effectiveStartDate);
  dispatchBy.setHours(20, 0, 0, 0);
  milestones.push({
    event: "DISPATCHED",
    expectedBy: dispatchBy,
    criticality: "HIGH",
  });

  // Milestone 5: First mile pickup
  const firstMileBy = new Date(dispatchBy);
  firstMileBy.setDate(firstMileBy.getDate() + 1);
  milestones.push({
    event: "FIRST_MILE_PICKUP",
    expectedBy: firstMileBy,
    criticality: "MEDIUM",
  });

  // Milestone 6: In transit hub
  const hubArrival = new Date(firstMileBy);
  hubArrival.setDate(hubArrival.getDate() + Math.floor(tatDays / 2));
  milestones.push({
    event: "HUB_ARRIVAL",
    expectedBy: hubArrival,
    criticality: "LOW",
  });

  // Milestone 7: Out for delivery
  const outForDelivery = new Date(promisedDeliveryDate);
  outForDelivery.setHours(8, 0, 0, 0);
  milestones.push({
    event: "OUT_FOR_DELIVERY",
    expectedBy: outForDelivery,
    criticality: "HIGH",
  });

  // Milestone 8: Delivery
  milestones.push({
    event: "DELIVERED",
    expectedBy: promisedDeliveryDate,
    criticality: "HIGH",
  });

  // Calculate risk level based on remaining time
  const now = new Date();
  const hoursRemaining = (promisedDeliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const expectedHours = tatDays * 24;
  const bufferRatio = hoursRemaining / expectedHours;

  let riskLevel: SLAResult["riskLevel"] = "LOW";
  if (bufferRatio < 0.25) riskLevel = "CRITICAL";
  else if (bufferRatio < 0.5) riskLevel = "HIGH";
  else if (bufferRatio < 0.75) riskLevel = "MEDIUM";

  return {
    promisedDeliveryDate,
    cutoffTime,
    tatDays,
    slaType: orderType,
    isAchievable: bufferRatio > 0,
    riskLevel,
    milestones,
  };
}

/**
 * Track SLA compliance for an order
 */
export async function trackSLACompliance(orderId: string): Promise<{
  orderId: string;
  currentStatus: string;
  slaStatus: "ON_TRACK" | "AT_RISK" | "BREACHED";
  promisedDate: Date | null;
  currentEta: Date | null;
  delayMinutes: number;
  breachedMilestones: string[];
  nextMilestone: {
    event: string;
    expectedBy: Date;
    remainingMinutes: number;
  } | null;
}> {
  const order = await prisma.unifiedOrder.findUnique({
    where: { id: orderId },
    include: {
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      location: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const now = new Date();
  const promisedDate = order.promisedDeliveryDate;
  const breachedMilestones: string[] = [];

  // Calculate SLA based on order details
  const slaConfig: SLAConfig = {
    orderType: (order.priority as "EXPRESS" | "STANDARD" | "ECONOMY") || "STANDARD",
    originPincode: order.location?.pincode || "110001",
    destinationPincode: order.pincode || "560001",
    orderPlacedAt: order.createdAt,
  };

  const sla = calculateSLA(slaConfig);

  // Check milestone breaches
  const statusMapping: Record<string, string> = {
    ALLOCATED: "INVENTORY_ALLOCATED",
    PICKED: "PICKING_COMPLETED",
    PACKED: "PACKING_COMPLETED",
    DISPATCHED: "DISPATCHED",
    IN_TRANSIT: "FIRST_MILE_PICKUP",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
  };

  const currentMilestoneIndex = sla.milestones.findIndex(
    m => m.event === statusMapping[order.status]
  );

  // Check for breached milestones
  for (let i = 0; i <= currentMilestoneIndex && i < sla.milestones.length; i++) {
    const milestone = sla.milestones[i];
    const historyEntry = order.statusHistory.find(
      h => statusMapping[h.status] === milestone.event
    );

    if (historyEntry && historyEntry.createdAt > milestone.expectedBy) {
      breachedMilestones.push(milestone.event);
    }
  }

  // Find next milestone
  const nextMilestoneIndex = currentMilestoneIndex + 1;
  const nextMilestone = nextMilestoneIndex < sla.milestones.length
    ? sla.milestones[nextMilestoneIndex]
    : null;

  // Calculate delay
  let delayMinutes = 0;
  if (promisedDate && promisedDate < now) {
    delayMinutes = Math.floor((now.getTime() - promisedDate.getTime()) / (1000 * 60));
  }

  // Determine SLA status
  let slaStatus: "ON_TRACK" | "AT_RISK" | "BREACHED" = "ON_TRACK";
  if (breachedMilestones.length > 0 || delayMinutes > 0) {
    slaStatus = "BREACHED";
  } else if (nextMilestone) {
    const remainingMinutes = (nextMilestone.expectedBy.getTime() - now.getTime()) / (1000 * 60);
    if (remainingMinutes < 30) {
      slaStatus = "AT_RISK";
    }
  }

  return {
    orderId,
    currentStatus: order.status,
    slaStatus,
    promisedDate,
    currentEta: sla.promisedDeliveryDate,
    delayMinutes,
    breachedMilestones,
    nextMilestone: nextMilestone ? {
      event: nextMilestone.event,
      expectedBy: nextMilestone.expectedBy,
      remainingMinutes: Math.floor((nextMilestone.expectedBy.getTime() - now.getTime()) / (1000 * 60)),
    } : null,
  };
}

// =============================================================================
// PARTNER SELECTION INTEGRATION
// =============================================================================

/**
 * Select optimal courier partner for an order with full context
 */
export async function selectPartnerForOrder(orderId: string): Promise<{
  orderId: string;
  recommended: {
    partnerId: string;
    partnerCode: string;
    partnerName: string;
    rate: number;
    estimatedTatDays: number;
    reliabilityScore: number;
    finalScore: number;
    selectionReason: string;
  } | null;
  alternatives: {
    partnerId: string;
    partnerCode: string;
    partnerName: string;
    rate: number;
    estimatedTatDays: number;
    reliabilityScore: number;
    finalScore: number;
  }[];
  slaCompatibility: {
    promisedDate: Date;
    partnerEta: Date;
    isCompatible: boolean;
    bufferDays: number;
  } | null;
}> {
  const order = await prisma.unifiedOrder.findUnique({
    where: { id: orderId },
    include: {
      location: true,
      brand: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Get client's preference weights (from brand settings or defaults)
  const clientWeights = {
    cost: 0.4,
    speed: 0.35,
    reliability: 0.25,
  };

  // Calculate chargeable weight
  const chargeableWeight = order.chargeableWeight || order.totalWeight || 0.5;

  // Select partner
  const result = await selectOptimalPartner({
    originPincode: order.location?.pincode || "110001",
    destinationPincode: order.pincode || "560001",
    weightKg: chargeableWeight,
    isCod: order.paymentMode === "COD",
    codAmount: order.paymentMode === "COD" ? Number(order.totalAmount) : 0,
    clientWeights,
  });

  if (!result) {
    return {
      orderId,
      recommended: null,
      alternatives: [],
      slaCompatibility: null,
    };
  }

  // Calculate SLA compatibility
  const promisedDate = order.promisedDeliveryDate || new Date();
  const partnerEta = new Date();
  partnerEta.setDate(partnerEta.getDate() + result.recommended.estimatedTatDays);

  const bufferDays = Math.floor(
    (promisedDate.getTime() - partnerEta.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Generate selection reason
  let selectionReason = "Best overall score based on ";
  const reasons: string[] = [];
  if (clientWeights.cost >= 0.4) reasons.push("cost optimization");
  if (clientWeights.speed >= 0.35) reasons.push("delivery speed");
  if (clientWeights.reliability >= 0.25) reasons.push("reliability");
  selectionReason += reasons.join(", ");

  if (result.recommended.reliabilityScore >= 90) {
    selectionReason += `. High reliability score (${result.recommended.reliabilityScore}%)`;
  }

  return {
    orderId,
    recommended: {
      ...result.recommended,
      selectionReason,
    },
    alternatives: result.alternatives,
    slaCompatibility: {
      promisedDate,
      partnerEta,
      isCompatible: bufferDays >= 0,
      bufferDays,
    },
  };
}

// =============================================================================
// PICKLIST OPTIMIZATION STRATEGIES
// =============================================================================

/**
 * Generate optimized picklists using specified strategy
 */
export async function generateOptimizedPicklists(
  orderIds: string[],
  strategy: PicklistStrategy
): Promise<{
  picklists: {
    id: string;
    orderIds: string[];
    zone?: string;
    priority: number;
    estimatedItems: number;
    estimatedTime: number; // in minutes
  }[];
  strategy: string;
  optimization: {
    totalOrders: number;
    totalPicklists: number;
    estimatedTimeSaved: number; // in minutes
  };
}> {
  const orders = await prisma.unifiedOrder.findMany({
    where: {
      id: { in: orderIds },
      status: "ALLOCATED",
    },
    include: {
      items: true,
      location: true,
    },
    orderBy: { priority: "desc" },
  });

  const picklists: {
    id: string;
    orderIds: string[];
    zone?: string;
    priority: number;
    estimatedItems: number;
    estimatedTime: number;
  }[] = [];

  switch (strategy.type) {
    case "WAVE": {
      // Wave picking: Group orders into waves based on cutoff times
      const maxOrders = strategy.config.maxOrdersPerWave || 50;
      for (let i = 0; i < orders.length; i += maxOrders) {
        const waveOrders = orders.slice(i, i + maxOrders);
        const totalItems = waveOrders.reduce((sum, o) => sum + o.items.length, 0);
        picklists.push({
          id: `WAVE-${Date.now()}-${i / maxOrders + 1}`,
          orderIds: waveOrders.map(o => o.id),
          priority: Math.max(...waveOrders.map(o => o.priority || 0)),
          estimatedItems: totalItems,
          estimatedTime: totalItems * 0.5, // 30 seconds per item
        });
      }
      break;
    }

    case "BATCH": {
      // Batch picking: Group similar SKUs together
      const skuGroups = new Map<string, typeof orders>();
      for (const order of orders) {
        for (const item of order.items) {
          const key = item.skuCode || item.skuId || "unknown";
          if (!skuGroups.has(key)) {
            skuGroups.set(key, []);
          }
          skuGroups.get(key)!.push(order);
        }
      }

      const batchSize = strategy.config.batchSize || 20;
      let batchCounter = 0;
      const processedOrders = new Set<string>();

      for (const [, skuOrders] of skuGroups) {
        const unprocessed = skuOrders.filter(o => !processedOrders.has(o.id));
        for (let i = 0; i < unprocessed.length; i += batchSize) {
          const batch = unprocessed.slice(i, i + batchSize);
          const batchOrderIds = batch.map(o => o.id);
          batchOrderIds.forEach(id => processedOrders.add(id));

          const totalItems = batch.reduce((sum, o) => sum + o.items.length, 0);
          picklists.push({
            id: `BATCH-${Date.now()}-${++batchCounter}`,
            orderIds: batchOrderIds,
            priority: Math.max(...batch.map(o => o.priority || 0)),
            estimatedItems: totalItems,
            estimatedTime: totalItems * 0.4, // Batch is faster
          });
        }
      }
      break;
    }

    case "ZONE": {
      // Zone picking: Group by warehouse zone
      const zoneGroups = new Map<string, typeof orders>();
      for (const order of orders) {
        // In production, zone would come from bin location
        const zone = order.locationId?.substring(0, 4) || "DEFAULT";
        if (!zoneGroups.has(zone)) {
          zoneGroups.set(zone, []);
        }
        zoneGroups.get(zone)!.push(order);
      }

      let zoneCounter = 0;
      for (const [zone, zoneOrders] of zoneGroups) {
        const totalItems = zoneOrders.reduce((sum, o) => sum + o.items.length, 0);
        picklists.push({
          id: `ZONE-${Date.now()}-${++zoneCounter}`,
          orderIds: zoneOrders.map(o => o.id),
          zone,
          priority: Math.max(...zoneOrders.map(o => o.priority || 0)),
          estimatedItems: totalItems,
          estimatedTime: totalItems * 0.35, // Zone picking is most efficient
        });
      }
      break;
    }

    case "SINGLE_ORDER":
    default: {
      // Single order picking: One picklist per order
      for (const order of orders) {
        const totalItems = order.items.length;
        picklists.push({
          id: `SINGLE-${Date.now()}-${order.orderNumber}`,
          orderIds: [order.id],
          priority: order.priority || 0,
          estimatedItems: totalItems,
          estimatedTime: totalItems * 0.6, // Single order is slowest
        });
      }
      break;
    }
  }

  // Sort picklists by priority
  picklists.sort((a, b) => b.priority - a.priority);

  // Calculate optimization metrics
  const singleOrderTime = orders.reduce((sum, o) => sum + o.items.length * 0.6, 0);
  const optimizedTime = picklists.reduce((sum, p) => sum + p.estimatedTime, 0);
  const timeSaved = singleOrderTime - optimizedTime;

  return {
    picklists,
    strategy: strategy.type,
    optimization: {
      totalOrders: orders.length,
      totalPicklists: picklists.length,
      estimatedTimeSaved: Math.max(0, timeSaved),
    },
  };
}

// =============================================================================
// LABEL GENERATION
// =============================================================================

export interface LabelData {
  orderId: string;
  orderNumber: string;
  awbNumber: string;
  courierName: string;
  senderName: string;
  senderAddress: string;
  senderPincode: string;
  senderPhone: string;
  receiverName: string;
  receiverAddress: string;
  receiverPincode: string;
  receiverPhone: string;
  weight: number;
  dimensions: string;
  paymentMode: string;
  codAmount?: number;
  itemCount: number;
  barcode: string;
  qrCode: string;
  routingCode: string;
}

/**
 * Generate shipping label data for an order
 */
export async function generateLabelData(orderId: string): Promise<LabelData> {
  const order = await prisma.unifiedOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      location: true,
      brand: true,
      transporter: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (!order.awbNumber) {
    throw new Error("AWB not assigned. Please assign courier partner first.");
  }

  // Generate routing code based on destination
  const destinationZone = getZoneType(order.pincode || "");
  const routingCode = `${destinationZone}-${order.pincode?.substring(0, 3) || "XXX"}`;

  // Generate barcode and QR data
  const barcode = order.awbNumber;
  const qrCode = JSON.stringify({
    awb: order.awbNumber,
    order: order.orderNumber,
    dest: order.pincode,
    cod: order.paymentMode === "COD" ? Number(order.totalAmount) : 0,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    awbNumber: order.awbNumber,
    courierName: order.transporter?.displayName || "Courier Partner",
    senderName: order.brand?.name || "Seller",
    senderAddress: order.location?.address || "",
    senderPincode: order.location?.pincode || "",
    senderPhone: order.location?.phone || "",
    receiverName: order.customerName,
    receiverAddress: [order.address1, order.address2, order.city, order.state].filter(Boolean).join(", "),
    receiverPincode: order.pincode || "",
    receiverPhone: order.phone || "",
    weight: order.chargeableWeight || order.totalWeight || 0.5,
    dimensions: `${order.length || 0}x${order.width || 0}x${order.height || 0} cm`,
    paymentMode: order.paymentMode || "PREPAID",
    codAmount: order.paymentMode === "COD" ? Number(order.totalAmount) : undefined,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    barcode,
    qrCode,
    routingCode,
  };
}

/**
 * Generate ZPL (Zebra Programming Language) for thermal label printing
 */
export function generateZPLLabel(data: LabelData): string {
  return `^XA
^FO50,50^A0N,40,40^FD${data.courierName}^FS
^FO50,100^BY3^BCN,100,Y,N,N^FD${data.barcode}^FS
^FO50,220^A0N,30,30^FDAWB: ${data.awbNumber}^FS
^FO50,260^A0N,25,25^FDOrder: ${data.orderNumber}^FS
^FO50,300^A0N,20,20^FDRouting: ${data.routingCode}^FS
^FO50,350^GB700,3,3^FS
^FO50,370^A0N,30,30^FDTO:^FS
^FO50,410^A0N,25,25^FD${data.receiverName}^FS
^FO50,450^A0N,20,20^FD${data.receiverAddress.substring(0, 50)}^FS
^FO50,480^A0N,20,20^FD${data.receiverAddress.substring(50, 100)}^FS
^FO50,510^A0N,25,25^FDPincode: ${data.receiverPincode}^FS
^FO50,550^A0N,20,20^FDPhone: ${data.receiverPhone}^FS
^FO50,600^GB700,3,3^FS
^FO50,620^A0N,30,30^FDFROM:^FS
^FO50,660^A0N,20,20^FD${data.senderName}^FS
^FO50,690^A0N,20,20^FD${data.senderPincode}^FS
^FO50,740^GB700,3,3^FS
^FO50,760^A0N,25,25^FDWeight: ${data.weight} kg | Items: ${data.itemCount}^FS
^FO50,800^A0N,25,25^FDDimensions: ${data.dimensions}^FS
${data.paymentMode === "COD" ? `^FO50,850^A0N,35,35^FDCOD: Rs ${data.codAmount}^FS` : ""}
^XZ`;
}
