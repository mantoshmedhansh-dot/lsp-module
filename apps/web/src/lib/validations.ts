import { z } from "zod";

export const createOrderSchema = z.object({
  clientOrderId: z.string().optional(),
  warehouseId: z.string().optional(),

  // Customer
  customerName: z.string().min(2, "Customer name is required"),
  customerPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid phone number (10 digits starting with 6-9)"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  deliveryAddress: z.string().min(10, "Complete address is required"),
  deliveryPincode: z.string().regex(/^\d{6}$/, "Invalid pincode (6 digits)"),
  deliveryCity: z.string().min(2, "City is required"),
  deliveryState: z.string().min(2, "State is required"),

  // Origin
  originPincode: z.string().regex(/^\d{6}$/, "Invalid pincode (6 digits)"),

  // Package
  weightKg: z.coerce.number().min(0.01, "Weight must be at least 0.01 kg"),
  lengthCm: z.coerce.number().min(0).optional(),
  widthCm: z.coerce.number().min(0).optional(),
  heightCm: z.coerce.number().min(0).optional(),

  // Item
  itemDescription: z.string().min(3, "Item description is required"),
  itemValue: z.coerce.number().min(1, "Item value must be at least 1"),
  itemQuantity: z.coerce.number().min(1).default(1),
  itemSku: z.string().optional(),

  // Payment
  paymentMode: z.enum(["PREPAID", "COD"]),
  codAmount: z.coerce.number().min(0).default(0),

  notes: z.string().optional(),
});

export const manifestOrderSchema = z.object({
  orderId: z.string().cuid(),
  partnerId: z.string().cuid().optional(),
  warehouseId: z.string().cuid().optional(),
});

export const pickOrderSchema = z.object({
  orderId: z.string().cuid(),
  pickedById: z.string().cuid(),
  notes: z.string().optional(),
});

export const packOrderSchema = z.object({
  orderId: z.string().cuid(),
  packedById: z.string().cuid(),
  weightKg: z.coerce.number().min(0.01),
  lengthCm: z.coerce.number().min(0).optional(),
  widthCm: z.coerce.number().min(0).optional(),
  heightCm: z.coerce.number().min(0).optional(),
});

export const dispatchOrderSchema = z.object({
  orderId: z.string().cuid(),
  dispatchedById: z.string().cuid(),
  handoverNotes: z.string().optional(),
});

export const podSchema = z.object({
  orderId: z.string().cuid(),
  signature: z.string().optional(), // Base64
  photo: z.string().optional(), // Base64
  otp: z.string().length(6).optional(),
  receiverName: z.string().min(2),
  receiverRelation: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ManifestOrderInput = z.infer<typeof manifestOrderSchema>;
export type PickOrderInput = z.infer<typeof pickOrderSchema>;
export type PackOrderInput = z.infer<typeof packOrderSchema>;
export type DispatchOrderInput = z.infer<typeof dispatchOrderSchema>;
export type PODInput = z.infer<typeof podSchema>;

// ============================================
// HUB VALIDATIONS
// ============================================

export const createHubSchema = z.object({
  code: z.string().min(2, "Hub code is required").max(20),
  name: z.string().min(3, "Hub name is required"),
  type: z.enum(["GATEWAY", "TRANSSHIPMENT", "SPOKE"]).default("TRANSSHIPMENT"),

  // Location
  address: z.string().min(10, "Complete address is required"),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode (6 digits)"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),

  // Capacity
  totalBays: z.coerce.number().min(1).default(10),
  loadingBays: z.coerce.number().min(1).default(5),
  unloadingBays: z.coerce.number().min(1).default(5),
  sortingCapacity: z.coerce.number().min(100).default(1000),

  // Operations
  operatingHoursStart: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM").default("06:00"),
  operatingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM").default("22:00"),

  // Contact
  contactName: z.string().min(2, "Contact name is required"),
  contactPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  contactEmail: z.string().email().optional().or(z.literal("")),
});

export const updateHubSchema = createHubSchema.partial();

export const hubPincodeMappingSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode (6 digits)"),
  type: z.enum(["PICKUP", "DELIVERY", "BOTH"]).default("DELIVERY"),
  priority: z.coerce.number().min(1).default(1),
});

export const createHubStaffSchema = z.object({
  employeeCode: z.string().min(2, "Employee code is required"),
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["MANAGER", "SUPERVISOR", "OPERATOR", "LOADER"]).default("OPERATOR"),
});

export type CreateHubInput = z.infer<typeof createHubSchema>;
export type UpdateHubInput = z.infer<typeof updateHubSchema>;
export type HubPincodeMappingInput = z.infer<typeof hubPincodeMappingSchema>;
export type CreateHubStaffInput = z.infer<typeof createHubStaffSchema>;

// ============================================
// VEHICLE VALIDATIONS
// ============================================

export const VEHICLE_TYPES = [
  "TATA_ACE",
  "EICHER_14FT",
  "TATA_407",
  "TATA_709",
  "TATA_1109",
  "CONTAINER_20FT",
  "CONTAINER_32FT",
] as const;

export const createVehicleSchema = z.object({
  registrationNo: z
    .string()
    .min(4, "Registration number is required")
    .regex(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/i, "Invalid registration format"),
  type: z.enum(VEHICLE_TYPES),

  // Capacity
  capacityTonnage: z.coerce.number().min(0.1, "Capacity must be at least 0.1 tons"),
  capacityVolumeCBM: z.coerce.number().min(1, "Volume must be at least 1 CBM"),

  // Dimensions
  lengthFt: z.coerce.number().min(0).optional(),
  widthFt: z.coerce.number().min(0).optional(),
  heightFt: z.coerce.number().min(0).optional(),

  // Vehicle Details
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().min(2000).max(new Date().getFullYear() + 1).optional(),
  fuelType: z.enum(["DIESEL", "PETROL", "CNG", "EV"]).default("DIESEL"),

  // Documents
  rcExpiryDate: z.coerce.date().optional(),
  insuranceExpiry: z.coerce.date().optional(),
  fitnessExpiry: z.coerce.date().optional(),
  permitExpiry: z.coerce.date().optional(),
  pollutionExpiry: z.coerce.date().optional(),

  // Status
  currentHubId: z.string().optional(),

  // Ownership
  ownershipType: z.enum(["OWNED", "LEASED", "ATTACHED"]).default("OWNED"),
  ownerName: z.string().optional(),
  ownerPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number").optional().or(z.literal("")),

  // GPS
  gpsDeviceId: z.string().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const vehicleMaintenanceSchema = z.object({
  type: z.enum(["SCHEDULED", "BREAKDOWN", "ACCIDENT", "INSPECTION"]),
  description: z.string().min(5, "Description is required"),
  odometerReading: z.coerce.number().min(0).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  cost: z.coerce.number().min(0).optional(),
  vendorName: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

// ============================================
// DRIVER VALIDATIONS
// ============================================

export const createDriverSchema = z.object({
  employeeCode: z.string().min(2, "Employee code is required"),
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  altPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number").optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),

  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode").optional().or(z.literal("")),

  // License
  licenseNumber: z.string().min(5, "License number is required"),
  licenseType: z.enum(["LMV", "HMV", "TRANS"]),
  licenseExpiry: z.coerce.date(),
  licenseState: z.string().optional(),

  // Identity
  aadharNumber: z.string().length(12, "Aadhar must be 12 digits").optional().or(z.literal("")),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal("")),

  // Status
  currentHubId: z.string().optional(),

  // Employment
  joiningDate: z.coerce.date(),
  yearsExperience: z.coerce.number().min(0).optional(),

  // Emergency Contact
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number").optional().or(z.literal("")),
});

export const updateDriverSchema = createDriverSchema.partial();

export const driverLeaveSchema = z.object({
  type: z.enum(["CASUAL", "SICK", "PLANNED", "EMERGENCY"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type VehicleMaintenanceInput = z.infer<typeof vehicleMaintenanceSchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type DriverLeaveInput = z.infer<typeof driverLeaveSchema>;

// ============================================
// ROUTE VALIDATIONS
// ============================================

export const ROUTE_TYPES = ["LINE_HAUL", "MILK_RUN_PICKUP", "MILK_RUN_DELIVERY", "FEEDER"] as const;
export const ROUTE_FREQUENCIES = ["DAILY", "MON_WED_FRI", "TUE_THU_SAT", "WEEKLY", "ON_DEMAND"] as const;

export const createRouteSchema = z.object({
  code: z.string().min(2, "Route code is required").max(20),
  name: z.string().min(3, "Route name is required"),
  type: z.enum(ROUTE_TYPES).default("LINE_HAUL"),

  // Route endpoints
  originHubId: z.string().optional(),
  destinationHubId: z.string().optional(),

  // Route details
  distanceKm: z.coerce.number().min(1, "Distance must be at least 1 km"),
  estimatedDurationMin: z.coerce.number().min(10, "Duration must be at least 10 minutes"),

  // For milk runs
  stops: z.string().optional(), // JSON string

  // Schedule
  departureTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM").optional(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM").optional(),
  frequency: z.enum(ROUTE_FREQUENCIES).default("DAILY"),

  // Cost
  baseCostPerTrip: z.coerce.number().min(0).optional(),
  fuelCostPerKm: z.coerce.number().min(0).optional(),
  tollCost: z.coerce.number().min(0).optional(),

  // Recommended vehicle
  recommendedVehicle: z.enum(VEHICLE_TYPES).optional(),
});

export const updateRouteSchema = createRouteSchema.partial();

// ============================================
// TRIP VALIDATIONS
// ============================================

export const TRIP_STATUSES = [
  "PLANNED",
  "LOADING",
  "READY",
  "IN_TRANSIT",
  "ARRIVED",
  "UNLOADING",
  "COMPLETED",
  "CANCELLED",
] as const;

export const TRIP_EVENT_TYPES = [
  "DEPARTURE",
  "ARRIVAL",
  "CHECKPOINT",
  "DELAY",
  "BREAKDOWN",
  "FUEL_STOP",
  "REST_STOP",
  "INCIDENT",
] as const;

export const createTripSchema = z.object({
  routeId: z.string().min(1, "Route is required"),
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required"),

  type: z.enum(ROUTE_TYPES).default("LINE_HAUL"),

  // Route overrides
  originHubId: z.string().optional(),
  destinationHubId: z.string().optional(),

  // Schedule
  scheduledDeparture: z.coerce.date(),
  scheduledArrival: z.coerce.date(),

  // Cost estimates
  estimatedCost: z.coerce.number().min(0).optional(),

  // Notes
  notes: z.string().optional(),
  sealNumber: z.string().optional(),
});

export const updateTripSchema = z.object({
  status: z.enum(TRIP_STATUSES).optional(),
  actualDeparture: z.coerce.date().optional(),
  actualArrival: z.coerce.date().optional(),

  // Live tracking
  lastLatitude: z.coerce.number().optional(),
  lastLongitude: z.coerce.number().optional(),
  currentLocation: z.string().optional(),

  // Distance
  actualDistanceKm: z.coerce.number().min(0).optional(),

  // Costs
  actualCost: z.coerce.number().min(0).optional(),
  fuelCost: z.coerce.number().min(0).optional(),
  tollCost: z.coerce.number().min(0).optional(),
  driverAllowance: z.coerce.number().min(0).optional(),
  otherExpenses: z.coerce.number().min(0).optional(),

  notes: z.string().optional(),
  sealNumber: z.string().optional(),
});

export const tripEventSchema = z.object({
  eventType: z.enum(TRIP_EVENT_TYPES),
  description: z.string().min(3, "Description is required"),
  location: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  hubId: z.string().optional(),
  eventTime: z.coerce.date(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type TripEventInput = z.infer<typeof tripEventSchema>;
