/**
 * Intelligent Order Orchestration Service - OMS Backend
 *
 * Core business logic for:
 * - Multi-warehouse inventory allocation with hopping
 * - SLA calculation and tracking
 * - Partner selection
 * - Picklist optimization
 * - Serviceability checks
 */

import { prisma } from "@oms/database";

// =============================================================================
// TYPES
// =============================================================================

export interface ServiceabilityResult {
  pincode: string;
  isServiceable: boolean;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  deliveryDays: number | null;
  zone: string | null;
  hub: { code: string; name: string; city: string } | null;
  serviceableTransporters: string[];
  lastMileAvailable: boolean;
}

export interface RouteServiceability {
  originPincode: string;
  destinationPincode: string;
  isServiceable: boolean;
  transporters: {
    id: string;
    code: string;
    name: string;
    codAvailable: boolean;
    estimatedTatDays: number;
    baseRate: number;
    ratePerKg: number;
  }[];
  routeType: string;
  estimatedTatDays: number;
}

export interface AllocationRequest {
  orderId: string;
  items: { skuId: string; quantity: number }[];
  destinationPincode: string;
  preferredLocationId?: string;
  config?: {
    enableHopping?: boolean;
    maxHops?: number;
    splitAllowed?: boolean;
  };
}

export interface AllocationResult {
  orderId: string;
  success: boolean;
  strategy: string;
  allocations: {
    skuId: string;
    requiredQty: number;
    allocatedQty: number;
    locations: {
      locationId: string;
      locationCode: string;
      quantity: number;
      hopLevel: number;
    }[];
    shortfall: number;
  }[];
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
  tatDays: number;
  slaType: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  milestones: {
    event: string;
    expectedBy: Date;
    criticality: string;
  }[];
}

export interface PartnerSelectionParams {
  originPincode: string;
  destinationPincode: string;
  weightKg: number;
  isCod: boolean;
  codAmount: number;
  weights?: { cost: number; speed: number; reliability: number };
}

export interface PartnerSelectionResult {
  recommended: {
    transporterId: string;
    transporterCode: string;
    transporterName: string;
    rate: number;
    estimatedTatDays: number;
    reliabilityScore: number;
    finalScore: number;
  } | null;
  alternatives: {
    transporterId: string;
    transporterCode: string;
    transporterName: string;
    rate: number;
    estimatedTatDays: number;
    reliabilityScore: number;
    finalScore: number;
  }[];
}

// =============================================================================
// ZONE CLASSIFICATION
// =============================================================================

const ZONE_MAP: Record<string, string> = {
  "110": "METRO", "400": "METRO", "560": "METRO", "600": "METRO", "700": "METRO",
  "500": "TIER1", "411": "TIER1", "380": "TIER1", "302": "TIER1", "226": "TIER1",
};

const TAT_MATRIX: Record<string, Record<string, number>> = {
  METRO_TO_METRO: { EXPRESS: 1, STANDARD: 2, ECONOMY: 4 },
  METRO_TO_TIER1: { EXPRESS: 2, STANDARD: 3, ECONOMY: 5 },
  METRO_TO_TIER2: { EXPRESS: 3, STANDARD: 4, ECONOMY: 6 },
  METRO_TO_REMOTE: { EXPRESS: 4, STANDARD: 5, ECONOMY: 8 },
  DEFAULT: { EXPRESS: 3, STANDARD: 5, ECONOMY: 7 },
};

function getZoneType(pincode: string): string {
  const prefix = pincode.substring(0, 3);
  return ZONE_MAP[prefix] || "TIER2";
}

function getRouteType(originZone: string, destZone: string): string {
  return `${originZone}_TO_${destZone}`;
}

// =============================================================================
// SERVICEABILITY CHECKS
// =============================================================================

/**
 * Check pincode serviceability
 */
export async function checkPincodeServiceability(
  pincode: string
): Promise<ServiceabilityResult> {
  if (!/^\d{6}$/.test(pincode)) {
    return {
      pincode,
      isServiceable: false,
      codAvailable: false,
      prepaidAvailable: false,
      deliveryDays: null,
      zone: null,
      hub: null,
      serviceableTransporters: [],
      lastMileAvailable: false,
    };
  }

  // Check transporter serviceability
  const servicePincodes = await prisma.servicePincode.findMany({
    where: {
      pincode,
      Transporter: { isActive: true },
    },
    include: {
      Transporter: { select: { id: true, code: true, name: true } },
    },
  });

  const isServiceable = servicePincodes.length > 0;
  const codAvailable = servicePincodes.some(t => t.codAvailable);
  const prepaidAvailable = servicePincodes.some(t => t.prepaidAvailable);
  const deliveryDays = servicePincodes.length > 0
    ? Math.min(...servicePincodes.filter(t => t.deliveryDays).map(t => t.deliveryDays!))
    : null;

  return {
    pincode,
    isServiceable,
    codAvailable,
    prepaidAvailable,
    deliveryDays,
    zone: getZoneType(pincode),
    hub: null, // Would query hub mapping
    serviceableTransporters: servicePincodes.map(t => t.Transporter.code),
    lastMileAvailable: isServiceable,
  };
}

/**
 * Check route serviceability between origin and destination
 */
export async function checkRouteServiceability(
  originPincode: string,
  destinationPincode: string,
  paymentMode: "PREPAID" | "COD" = "PREPAID"
): Promise<RouteServiceability> {
  const [originCheck, destCheck] = await Promise.all([
    checkPincodeServiceability(originPincode),
    checkPincodeServiceability(destinationPincode),
  ]);

  // Get transporters that service both pincodes
  const originTransporters = new Set(originCheck.serviceableTransporters);
  const destTransporters = destCheck.serviceableTransporters;
  const commonTransporters = destTransporters.filter(t => originTransporters.has(t));

  // Get transporters
  const transporters = await prisma.transporter.findMany({
    where: {
      code: { in: commonTransporters },
      isActive: true,
    },
  });

  // Get rate cards for these transporters
  const rateCards = await prisma.rateCard.findMany({
    where: {
      transporterId: { in: transporters.map(t => t.id) },
      status: "ACTIVE",
    },
    include: {
      RateCardSlab: true,
    },
  });

  const rateCardMap = new Map(rateCards.map(rc => [rc.transporterId, rc]));

  // Check COD availability from destination service pincodes
  const destServicePincodes = await prisma.servicePincode.findMany({
    where: {
      pincode: destinationPincode,
      transporterId: { in: transporters.map(t => t.id) },
    },
  });
  const codAvailableMap = new Map(destServicePincodes.map(sp => [sp.transporterId, sp.codAvailable]));

  const routeType = getRouteType(originCheck.zone || "TIER2", destCheck.zone || "TIER2");

  // Filter transporters based on payment mode
  const filteredTransporters = paymentMode === "COD"
    ? transporters.filter(t => codAvailableMap.get(t.id) === true)
    : transporters;

  return {
    originPincode,
    destinationPincode,
    isServiceable: filteredTransporters.length > 0,
    transporters: filteredTransporters.map(t => {
      const rateCard = rateCardMap.get(t.id);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        codAvailable: codAvailableMap.get(t.id) ?? false,
        estimatedTatDays: destCheck.deliveryDays || 5,
        baseRate: rateCard ? Number(rateCard.baseCost) : 50,
        ratePerKg: 15, // Default rate per kg - would come from RateCardSlab
      };
    }),
    routeType,
    estimatedTatDays: destCheck.deliveryDays || 5,
  };
}

// =============================================================================
// MULTI-WAREHOUSE ALLOCATION WITH HOPPING
// =============================================================================

/**
 * Allocate inventory with multi-warehouse hopping support
 */
export async function allocateWithHopping(
  request: AllocationRequest
): Promise<AllocationResult> {
  const {
    orderId,
    items,
    destinationPincode,
    preferredLocationId,
    config = {},
  } = request;

  const {
    enableHopping = true,
    maxHops = 3,
    splitAllowed = true,
  } = config;

  const allocations: AllocationResult["allocations"] = [];
  let totalHops = 0;
  let splitRequired = false;

  // Get all locations with inventory for these SKUs
  const skuIds = items.map(i => i.skuId);

  for (const item of items) {
    const requiredQty = item.quantity;
    let remainingQty = requiredQty;
    const locationAllocations: AllocationResult["allocations"][0]["locations"] = [];
    let hopLevel = 0;

    // Get all inventory for this SKU across locations
    const inventoryByLocation = await prisma.inventory.groupBy({
      by: ["locationId"],
      where: {
        skuId: item.skuId,
        quantity: { gt: 0 },
      },
      _sum: {
        quantity: true,
        reservedQty: true,
      },
    });

    // Get location details
    const locationIds = inventoryByLocation.map(i => i.locationId);
    const locationsData = await prisma.location.findMany({
      where: { id: { in: locationIds }, isActive: true },
    });
    const locationMap = new Map(locationsData.map(l => [l.id, l]));

    // Sort by preference: preferred location first, then by distance to destination
    const sortedInventory = inventoryByLocation.sort((a, b) => {
      if (a.locationId === preferredLocationId) return -1;
      if (b.locationId === preferredLocationId) return 1;
      // In production, would sort by distance to destination
      return 0;
    });

    // Allocate from each location
    for (const inv of sortedInventory) {
      if (remainingQty <= 0) break;
      if (!enableHopping && hopLevel > 0) break;
      if (hopLevel >= maxHops) break;

      const location = locationMap.get(inv.locationId);
      if (!location) continue;

      const availableQty = (inv._sum.quantity || 0) - (inv._sum.reservedQty || 0);
      const allocateQty = Math.min(remainingQty, availableQty);

      if (allocateQty > 0) {
        // Reserve inventory
        const inventoryRecords = await prisma.inventory.findMany({
          where: {
            skuId: item.skuId,
            locationId: inv.locationId,
            quantity: { gt: 0 },
          },
          orderBy: { createdAt: "asc" }, // FIFO
        });

        let toReserve = allocateQty;
        for (const record of inventoryRecords) {
          if (toReserve <= 0) break;
          const available = record.quantity - record.reservedQty;
          const reserveAmount = Math.min(toReserve, available);

          if (reserveAmount > 0) {
            await prisma.inventory.update({
              where: { id: record.id },
              data: { reservedQty: record.reservedQty + reserveAmount },
            });
            toReserve -= reserveAmount;
          }
        }

        locationAllocations.push({
          locationId: inv.locationId,
          locationCode: location.code,
          quantity: allocateQty,
          hopLevel,
        });

        remainingQty -= allocateQty;

        if (hopLevel > 0) {
          totalHops++;
          splitRequired = true;
        }
        hopLevel++;
      }
    }

    allocations.push({
      skuId: item.skuId,
      requiredQty,
      allocatedQty: requiredQty - remainingQty,
      locations: locationAllocations,
      shortfall: remainingQty,
    });
  }

  const success = allocations.every(a => a.shortfall === 0);

  // Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: success ? "ALLOCATED" : "PARTIALLY_ALLOCATED",
    },
  });

  return {
    orderId,
    success,
    strategy: enableHopping ? `MULTI_WAREHOUSE_HOPPING (max ${maxHops} hops)` : "SINGLE_WAREHOUSE",
    allocations,
    totalHops,
    splitRequired,
  };
}

// =============================================================================
// SLA CALCULATION
// =============================================================================

/**
 * Calculate SLA for an order
 */
export function calculateSLA(config: SLAConfig): SLAResult {
  const { orderType, originPincode, destinationPincode, orderPlacedAt } = config;

  const originZone = getZoneType(originPincode);
  const destZone = getZoneType(destinationPincode);
  const routeType = getRouteType(originZone, destZone);

  const tatMatrix = TAT_MATRIX[routeType] || TAT_MATRIX.DEFAULT;
  const tatDays = tatMatrix[orderType] || 5;

  // Cutoff time handling
  const cutoffHour = 14; // 2 PM
  const effectiveStart = new Date(orderPlacedAt);
  if (orderPlacedAt.getHours() >= cutoffHour) {
    effectiveStart.setDate(effectiveStart.getDate() + 1);
  }

  const promisedDeliveryDate = new Date(effectiveStart);
  promisedDeliveryDate.setDate(promisedDeliveryDate.getDate() + tatDays);

  // Calculate milestones
  const milestones: SLAResult["milestones"] = [];

  const allocationBy = new Date(orderPlacedAt);
  allocationBy.setHours(allocationBy.getHours() + 2);
  milestones.push({ event: "ALLOCATED", expectedBy: allocationBy, criticality: "HIGH" });

  const pickingBy = new Date(allocationBy);
  pickingBy.setHours(pickingBy.getHours() + 4);
  milestones.push({ event: "PICKED", expectedBy: pickingBy, criticality: "HIGH" });

  const packingBy = new Date(pickingBy);
  packingBy.setHours(packingBy.getHours() + 2);
  milestones.push({ event: "PACKED", expectedBy: packingBy, criticality: "MEDIUM" });

  const dispatchBy = new Date(effectiveStart);
  dispatchBy.setHours(20, 0, 0, 0);
  milestones.push({ event: "DISPATCHED", expectedBy: dispatchBy, criticality: "HIGH" });

  milestones.push({ event: "DELIVERED", expectedBy: promisedDeliveryDate, criticality: "HIGH" });

  // Calculate risk level
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
    tatDays,
    slaType: orderType,
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
  delayMinutes: number;
  breachedMilestones: string[];
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { Location: true },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const now = new Date();
  const promisedDate = order.promisedDate;
  let delayMinutes = 0;

  if (promisedDate && promisedDate < now) {
    delayMinutes = Math.floor((now.getTime() - promisedDate.getTime()) / (1000 * 60));
  }

  // Determine SLA status
  let slaStatus: "ON_TRACK" | "AT_RISK" | "BREACHED" = "ON_TRACK";
  if (delayMinutes > 0) {
    slaStatus = "BREACHED";
  } else if (promisedDate) {
    const hoursRemaining = (promisedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursRemaining < 4) {
      slaStatus = "AT_RISK";
    }
  }

  return {
    orderId,
    currentStatus: order.status,
    slaStatus,
    promisedDate,
    delayMinutes,
    breachedMilestones: [], // Would calculate from order history
  };
}

// =============================================================================
// PARTNER SELECTION
// =============================================================================

/**
 * Select optimal transporter for shipment
 */
export async function selectOptimalPartner(
  params: PartnerSelectionParams
): Promise<PartnerSelectionResult> {
  const {
    originPincode,
    destinationPincode,
    weightKg,
    isCod,
    codAmount,
    weights = { cost: 0.4, speed: 0.35, reliability: 0.25 },
  } = params;

  // Get route serviceability
  const route = await checkRouteServiceability(
    originPincode,
    destinationPincode,
    isCod ? "COD" : "PREPAID"
  );

  if (route.transporters.length === 0) {
    return { recommended: null, alternatives: [] };
  }

  // Calculate rates and scores
  const options = route.transporters.map(t => {
    let rate = t.baseRate + t.ratePerKg * weightKg;
    if (isCod && codAmount > 0) {
      rate += Math.max(25, codAmount * 0.015); // 1.5% COD charge, min 25
    }

    return {
      transporterId: t.id,
      transporterCode: t.code,
      transporterName: t.name,
      rate,
      estimatedTatDays: t.estimatedTatDays,
      reliabilityScore: 85 + Math.random() * 10, // Would come from performance data
      finalScore: 0,
    };
  });

  // Normalize and calculate scores
  const rates = options.map(o => o.rate);
  const tats = options.map(o => o.estimatedTatDays);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const minTat = Math.min(...tats);
  const maxTat = Math.max(...tats);

  for (const option of options) {
    const costScore = 100 * (1 - (option.rate - minRate) / (maxRate - minRate || 1));
    const speedScore = 100 * (1 - (option.estimatedTatDays - minTat) / (maxTat - minTat || 1));
    const reliabilityScore = option.reliabilityScore;

    option.finalScore =
      weights.cost * costScore +
      weights.speed * speedScore +
      weights.reliability * reliabilityScore;
  }

  // Sort by score
  options.sort((a, b) => b.finalScore - a.finalScore);

  return {
    recommended: options[0],
    alternatives: options.slice(1),
  };
}

// =============================================================================
// LABEL GENERATION
// =============================================================================

export interface LabelData {
  orderId: string;
  orderNo: string;
  awbNo: string;
  transporterName: string;
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
  routingCode: string;
}

/**
 * Generate label data for an order
 */
export async function generateLabelData(orderId: string): Promise<LabelData> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      OrderItem: {
        include: {
          SKU: true,
        },
      },
      Location: true,
      Delivery: {
        include: { Transporter: true },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const delivery = order.Delivery[0];
  if (!delivery?.awbNo) {
    throw new Error("AWB not assigned");
  }

  const shippingAddress = order.shippingAddress as any;
  const destZone = getZoneType(shippingAddress?.pincode || "000000");
  const routingCode = `${destZone}-${(shippingAddress?.pincode || "000000").substring(0, 3)}`;

  const locationAddress = order.Location?.address as any;

  // Calculate total weight from order items
  const totalWeight = order.OrderItem.reduce((sum, item) => {
    const itemWeight = item.SKU?.weight ? Number(item.SKU.weight) : 0;
    return sum + (itemWeight * item.quantity);
  }, 0) || 0.5;

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    awbNo: delivery.awbNo,
    transporterName: delivery.Transporter?.name || "Courier",
    senderName: order.Location?.name || "Seller",
    senderAddress: locationAddress ? [locationAddress.addressLine1, locationAddress.city, locationAddress.state].filter(Boolean).join(", ") : "",
    senderPincode: locationAddress?.pincode || "",
    senderPhone: order.Location?.contactPhone || "",
    receiverName: order.customerName,
    receiverAddress: [
      shippingAddress?.addressLine1,
      shippingAddress?.addressLine2,
      shippingAddress?.city,
      shippingAddress?.state,
    ].filter(Boolean).join(", "),
    receiverPincode: shippingAddress?.pincode || "",
    receiverPhone: order.customerPhone,
    weight: totalWeight,
    dimensions: "N/A",
    paymentMode: order.paymentMode,
    codAmount: order.paymentMode === "COD" ? Number(order.totalAmount) : undefined,
    itemCount: order.OrderItem.reduce((sum, i) => sum + i.quantity, 0),
    barcode: delivery.awbNo,
    routingCode,
  };
}

/**
 * Generate ZPL label format
 */
export function generateZPLLabel(data: LabelData): string {
  return `^XA
^FO50,50^A0N,40,40^FD${data.transporterName}^FS
^FO50,100^BY3^BCN,100,Y,N,N^FD${data.barcode}^FS
^FO50,220^A0N,30,30^FDAWB: ${data.awbNo}^FS
^FO50,260^A0N,25,25^FDOrder: ${data.orderNo}^FS
^FO50,300^A0N,20,20^FDRouting: ${data.routingCode}^FS
^FO50,350^GB700,3,3^FS
^FO50,370^A0N,30,30^FDTO:^FS
^FO50,410^A0N,25,25^FD${data.receiverName}^FS
^FO50,450^A0N,20,20^FD${data.receiverAddress.substring(0, 50)}^FS
^FO50,510^A0N,25,25^FDPincode: ${data.receiverPincode}^FS
^FO50,550^A0N,20,20^FDPhone: ${data.receiverPhone}^FS
^FO50,600^GB700,3,3^FS
^FO50,620^A0N,25,25^FDWeight: ${data.weight} kg | Items: ${data.itemCount}^FS
${data.paymentMode === "COD" ? `^FO50,660^A0N,35,35^FDCOD: Rs ${data.codAmount}^FS` : ""}
^XZ`;
}
