// ============================================
// ORDER STATUS & FLOW
// ============================================

export type OrderStage =
  | "manifestation"
  | "pick"
  | "pack"
  | "dispatch"
  | "delivery"
  | "pod";

export const ORDER_STAGES: OrderStage[] = [
  "manifestation",
  "pick",
  "pack",
  "dispatch",
  "delivery",
  "pod",
];

export const STAGE_STATUS_MAP = {
  manifestation: ["CREATED", "PARTNER_ASSIGNED", "AWB_GENERATED"],
  pick: ["PICKUP_SCHEDULED", "PICKUP_PENDING", "PICKED"],
  pack: ["PACKING", "PACKED", "LABELLED"],
  dispatch: ["READY_TO_DISPATCH", "DISPATCHED", "HANDED_OVER"],
  delivery: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
  pod: ["DELIVERED"],
} as const;

export const STATUS_LABELS: Record<string, string> = {
  CREATED: "Order Created",
  PARTNER_ASSIGNED: "Partner Assigned",
  AWB_GENERATED: "AWB Generated",
  PICKUP_SCHEDULED: "Pickup Scheduled",
  PICKUP_PENDING: "Pickup Pending",
  PICKED: "Picked",
  PACKING: "Packing",
  PACKED: "Packed",
  LABELLED: "Labelled",
  READY_TO_DISPATCH: "Ready to Dispatch",
  DISPATCHED: "Dispatched",
  HANDED_OVER: "Handed Over",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  NDR: "NDR",
  RTO_INITIATED: "RTO Initiated",
  RTO_IN_TRANSIT: "RTO In Transit",
  RTO_DELIVERED: "RTO Delivered",
  CANCELLED: "Cancelled",
  LOST: "Lost",
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  CREATED: { bg: "bg-gray-100", text: "text-gray-700" },
  PARTNER_ASSIGNED: { bg: "bg-blue-100", text: "text-blue-700" },
  AWB_GENERATED: { bg: "bg-blue-100", text: "text-blue-700" },
  PICKUP_SCHEDULED: { bg: "bg-purple-100", text: "text-purple-700" },
  PICKUP_PENDING: { bg: "bg-purple-100", text: "text-purple-700" },
  PICKED: { bg: "bg-purple-100", text: "text-purple-700" },
  PACKING: { bg: "bg-indigo-100", text: "text-indigo-700" },
  PACKED: { bg: "bg-indigo-100", text: "text-indigo-700" },
  LABELLED: { bg: "bg-indigo-100", text: "text-indigo-700" },
  READY_TO_DISPATCH: { bg: "bg-orange-100", text: "text-orange-700" },
  DISPATCHED: { bg: "bg-orange-100", text: "text-orange-700" },
  HANDED_OVER: { bg: "bg-orange-100", text: "text-orange-700" },
  IN_TRANSIT: { bg: "bg-teal-100", text: "text-teal-700" },
  OUT_FOR_DELIVERY: { bg: "bg-teal-100", text: "text-teal-700" },
  DELIVERED: { bg: "bg-green-100", text: "text-green-700" },
  NDR: { bg: "bg-amber-100", text: "text-amber-700" },
  RTO_INITIATED: { bg: "bg-red-100", text: "text-red-700" },
  RTO_IN_TRANSIT: { bg: "bg-red-100", text: "text-red-700" },
  RTO_DELIVERED: { bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { bg: "bg-gray-100", text: "text-gray-700" },
  LOST: { bg: "bg-red-100", text: "text-red-700" },
};

// ============================================
// ORDER DTOs
// ============================================

export interface CreateOrderInput {
  clientOrderId?: string;
  warehouseId?: string;

  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryPincode: string;
  deliveryCity: string;
  deliveryState: string;

  // Origin
  originPincode: string;

  // Package
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;

  // Item
  itemDescription: string;
  itemValue: number;
  itemQuantity?: number;
  itemSku?: string;

  // Payment
  paymentMode: "PREPAID" | "COD";
  codAmount?: number;

  notes?: string;
}

export interface ManifestOrderInput {
  orderId: string;
  partnerId?: string; // If not provided, use auto-selection
  warehouseId?: string;
}

export interface PickOrderInput {
  orderId: string;
  pickedById: string;
  notes?: string;
}

export interface PackOrderInput {
  orderId: string;
  packedById: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface DispatchOrderInput {
  orderId: string;
  dispatchedById: string;
  handoverNotes?: string;
}

export interface PODInput {
  orderId: string;
  signature?: string; // Base64 image
  photo?: string; // Base64 image
  otp?: string;
  receiverName: string;
  receiverRelation?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================
// PARTNER SELECTION
// ============================================

export interface PartnerSelectionRequest {
  originPincode: string;
  destinationPincode: string;
  weightKg: number;
  isCod: boolean;
  codAmount?: number;
  clientWeights?: {
    cost: number;
    speed: number;
    reliability: number;
  };
}

export interface PartnerOption {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  rate: number;
  estimatedTatDays: number;
  reliabilityScore: number;
  finalScore: number;
  scores: {
    cost: number;
    speed: number;
    reliability: number;
  };
}

export interface PartnerSelectionResult {
  recommended: PartnerOption;
  alternatives: PartnerOption[];
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
