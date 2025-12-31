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
