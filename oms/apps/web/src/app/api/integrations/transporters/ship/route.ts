import { NextRequest, NextResponse } from "next/server";
import { prisma, DeliveryStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/integrations/transporters/ship - Create shipment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, transporterId, serviceType, pickupDate, weight, dimensions } = body;

    if (!orderId || !transporterId) {
      return NextResponse.json(
        { error: "Order ID and transporter ID are required" },
        { status: 400 }
      );
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
        Location: {
          include: {
            Company: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get transporter details
    const transporter = await prisma.transporter.findUnique({
      where: { id: transporterId },
    });

    if (!transporter) {
      return NextResponse.json({ error: "Transporter not found" }, { status: 404 });
    }

    if (!transporter.apiEnabled || !transporter.apiConfig) {
      return NextResponse.json(
        { error: "Transporter API not configured" },
        { status: 400 }
      );
    }

    const apiConfig = transporter.apiConfig as {
      apiKey?: string;
      email?: string;
      password?: string;
      clientId?: string;
      clientSecret?: string;
      apiEndpoint?: string;
    };

    if (!apiConfig.apiEndpoint) {
      return NextResponse.json(
        { error: "Transporter API endpoint not configured" },
        { status: 400 }
      );
    }

    // Parse addresses
    const shippingAddr = order.shippingAddress as {
      name?: string;
      phone?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };

    const locationAddr = order.Location.address as {
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };

    // Create shipment based on transporter
    let shipmentResult: { awbNo: string; trackingUrl?: string };

    try {
      switch (transporter.code.toUpperCase()) {
        case "SHIPROCKET":
          shipmentResult = await createShiprocketShipment(
            apiConfig,
            apiConfig.apiEndpoint!,
            order,
            shippingAddr,
            locationAddr,
            serviceType,
            weight,
            dimensions
          );
          break;

        case "DELHIVERY":
          shipmentResult = await createDelhiveryShipment(
            apiConfig,
            apiConfig.apiEndpoint!,
            order,
            shippingAddr,
            locationAddr,
            serviceType,
            weight
          );
          break;

        default:
          return NextResponse.json(
            { error: `Transporter ${transporter.code} not supported for auto-shipping` },
            { status: 400 }
          );
      }
    } catch (shipError) {
      console.error("Shipment creation error:", shipError);
      return NextResponse.json(
        { error: `Failed to create shipment: ${shipError instanceof Error ? shipError.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    // Generate delivery number
    const sequence = await prisma.sequence.upsert({
      where: { name: "delivery" },
      update: { currentValue: { increment: 1 } },
      create: { name: "delivery", prefix: "DEL", currentValue: 1 },
    });

    const deliveryNo = `DEL${String(sequence.currentValue).padStart(8, "0")}`;

    // Create delivery record
    const delivery = await prisma.delivery.create({
      data: {
        deliveryNo,
        orderId: order.id,
        transporterId: transporter.id,
        awbNo: shipmentResult.awbNo,
        status: "MANIFESTED" as DeliveryStatus,
        weight: weight || 0.5,
        length: dimensions?.length,
        width: dimensions?.width,
        height: dimensions?.height,
        trackingUrl: shipmentResult.trackingUrl,
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "MANIFESTED",
      },
    });

    return NextResponse.json({
      success: true,
      delivery: {
        id: delivery.id,
        deliveryNo: delivery.deliveryNo,
        awbNo: delivery.awbNo,
        trackingUrl: delivery.trackingUrl,
        status: delivery.status,
      },
    });
  } catch (error) {
    console.error("Error creating shipment:", error);
    return NextResponse.json(
      { error: "Failed to create shipment" },
      { status: 500 }
    );
  }
}

interface OrderData {
  orderNo: string;
  externalOrderNo?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  paymentMode: string;
  totalAmount: { toNumber(): number };
  OrderItem: { quantity: number; SKU: { code: string; name: string } }[];
  Location: {
    name: string;
    Company: { name: string; phone?: string | null; email?: string | null };
  };
}

interface AddressData {
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

async function createShiprocketShipment(
  apiConfig: { apiKey?: string; email?: string; password?: string },
  apiEndpoint: string,
  order: OrderData,
  shippingAddr: AddressData,
  pickupAddr: AddressData,
  serviceType?: string,
  weight?: number,
  dimensions?: { length: number; width: number; height: number }
): Promise<{ awbNo: string; trackingUrl?: string }> {
  // Authenticate with Shiprocket
  const authResponse = await fetch(`${apiEndpoint}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: apiConfig.email,
      password: apiConfig.password,
    }),
  });

  if (!authResponse.ok) {
    throw new Error("Failed to authenticate with Shiprocket");
  }

  const authData = await authResponse.json();
  const token = authData.token;

  // Create order in Shiprocket
  const orderPayload = {
    order_id: order.orderNo,
    order_date: new Date().toISOString().split("T")[0],
    pickup_location: order.Location.name,
    channel_id: "",
    billing_customer_name: order.customerName,
    billing_last_name: "",
    billing_address: shippingAddr.addressLine1,
    billing_address_2: shippingAddr.addressLine2 || "",
    billing_city: shippingAddr.city,
    billing_pincode: shippingAddr.pincode,
    billing_state: shippingAddr.state,
    billing_country: "India",
    billing_email: order.customerEmail || "",
    billing_phone: order.customerPhone,
    shipping_is_billing: true,
    order_items: order.OrderItem.map((item) => ({
      name: item.SKU.name,
      sku: item.SKU.code,
      units: item.quantity,
      selling_price: order.totalAmount.toNumber() / order.OrderItem.length,
    })),
    payment_method: order.paymentMode === "COD" ? "COD" : "Prepaid",
    sub_total: order.totalAmount.toNumber(),
    length: dimensions?.length || 10,
    breadth: dimensions?.width || 10,
    height: dimensions?.height || 10,
    weight: weight || 0.5,
  };

  const createResponse = await fetch(`${apiEndpoint}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create Shiprocket order");
  }

  const createData = await createResponse.json();
  const shiprocketOrderId = createData.order_id;
  const shipmentId = createData.shipment_id;

  // Generate AWB
  const awbPayload = {
    shipment_id: shipmentId,
    courier_id: serviceType || "", // Empty for auto-select
  };

  const awbResponse = await fetch(`${apiEndpoint}/courier/assign/awb`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(awbPayload),
  });

  if (!awbResponse.ok) {
    throw new Error("Failed to generate AWB");
  }

  const awbData = await awbResponse.json();

  return {
    awbNo: awbData.response?.data?.awb_code || `SR${shiprocketOrderId}`,
    trackingUrl: `https://shiprocket.co/tracking/${awbData.response?.data?.awb_code}`,
  };
}

async function createDelhiveryShipment(
  apiConfig: { apiKey?: string; clientId?: string },
  apiEndpoint: string,
  order: OrderData,
  shippingAddr: AddressData,
  pickupAddr: AddressData,
  serviceType?: string,
  weight?: number
): Promise<{ awbNo: string; trackingUrl?: string }> {
  const waybillResponse = await fetch(`${apiEndpoint}/waybill/api/bulk/json/`, {
    method: "GET",
    headers: {
      Authorization: `Token ${apiConfig.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!waybillResponse.ok) {
    throw new Error("Failed to fetch waybill from Delhivery");
  }

  const waybillData = await waybillResponse.json();
  const awbNo = waybillData.waybill || "";

  // Create shipment
  const shipmentData = {
    shipments: [
      {
        name: order.customerName,
        add: shippingAddr.addressLine1,
        city: shippingAddr.city,
        state: shippingAddr.state,
        pin: shippingAddr.pincode,
        phone: order.customerPhone,
        order: order.orderNo,
        payment_mode: order.paymentMode === "COD" ? "COD" : "Pre-paid",
        cod_amount: order.paymentMode === "COD" ? order.totalAmount.toNumber() : 0,
        weight: (weight || 0.5) * 1000, // Convert to grams
        waybill: awbNo,
        client: apiConfig.clientId || "",
      },
    ],
    pickup_location: {
      name: order.Location.Company.name,
      add: pickupAddr.addressLine1,
      city: pickupAddr.city,
      state: pickupAddr.state,
      pin: pickupAddr.pincode,
      phone: order.Location.Company.phone || "",
    },
  };

  const createResponse = await fetch(`${apiEndpoint}/api/cmu/create.json`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(shipmentData),
  });

  if (!createResponse.ok) {
    throw new Error("Failed to create Delhivery shipment");
  }

  return {
    awbNo,
    trackingUrl: `https://www.delhivery.com/track/package/${awbNo}`,
  };
}
