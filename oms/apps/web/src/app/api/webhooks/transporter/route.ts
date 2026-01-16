import { NextRequest, NextResponse } from "next/server";
import { prisma, DeliveryStatus, OrderStatus } from "@oms/database";

// POST /api/webhooks/transporter - Handle transporter webhooks
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    if (!source) {
      return NextResponse.json(
        { error: "Source parameter is required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    switch (source.toLowerCase()) {
      case "shiprocket":
        return handleShiprocketWebhook(body);
      case "delhivery":
        return handleDelhiveryWebhook(body);
      default:
        return NextResponse.json(
          { error: `Unknown source: ${source}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleShiprocketWebhook(payload: {
  awb: string;
  current_status: string;
  current_status_id: number;
  shipment_status: string;
  shipment_status_id: number;
  scans?: { location: string; date: string; activity: string; status: string }[];
  etd?: string;
  delivered_date?: string;
  pod?: string;
  pod_images?: string[];
}): Promise<NextResponse> {
  const { awb, current_status, shipment_status, scans, delivered_date, pod, pod_images } = payload;

  if (!awb) {
    return NextResponse.json({ error: "AWB is required" }, { status: 400 });
  }

  // Find delivery by AWB
  const delivery = await prisma.delivery.findFirst({
    where: { awbNo: awb },
    include: { Order: true },
  });

  if (!delivery) {
    console.log(`Delivery not found for AWB: ${awb}`);
    return NextResponse.json({ received: true, message: "Delivery not found" });
  }

  // Map Shiprocket status to our status
  // DeliveryStatus: PENDING, PACKED, MANIFESTED, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED
  const statusMap: Record<string, DeliveryStatus> = {
    "6": "SHIPPED",
    "7": "DELIVERED",
    "17": "IN_TRANSIT",
    "18": "IN_TRANSIT",
    "19": "OUT_FOR_DELIVERY",
    "20": "OUT_FOR_DELIVERY",
    "8": "RTO_INITIATED",
    "9": "RTO_IN_TRANSIT",
    "10": "RTO_DELIVERED",
    "11": "CANCELLED",
  };

  const newStatus = statusMap[payload.shipment_status_id?.toString()] ||
    mapShiprocketTextStatus(shipment_status);

  // Update delivery
  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "DELIVERED") {
    updateData.shipDate = delivered_date ? new Date(delivered_date) : new Date();
  }

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: updateData,
  });

  // Update order status
  const orderStatus = mapDeliveryToOrderStatus(newStatus);
  if (orderStatus && delivery.Order.status !== orderStatus) {
    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: orderStatus },
    });
  }

  return NextResponse.json({
    received: true,
    awb,
    status: newStatus,
  });
}

async function handleDelhiveryWebhook(payload: {
  Waybill: string;
  Status: {
    Status: string;
    StatusCode: string;
    StatusType: string;
    StatusLocation: string;
    StatusDateTime: string;
    Instructions: string;
  };
  EDD?: string;
}): Promise<NextResponse> {
  const { Waybill: awb, Status: status, EDD } = payload;

  if (!awb) {
    return NextResponse.json({ error: "Waybill is required" }, { status: 400 });
  }

  // Find delivery by AWB
  const delivery = await prisma.delivery.findFirst({
    where: { awbNo: awb },
    include: { Order: true },
  });

  if (!delivery) {
    console.log(`Delivery not found for AWB: ${awb}`);
    return NextResponse.json({ received: true, message: "Delivery not found" });
  }

  // Map Delhivery status
  const newStatus = mapDelhiveryStatus(status.Status);

  // Update delivery
  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "DELIVERED") {
    updateData.shipDate = status.StatusDateTime
      ? new Date(status.StatusDateTime)
      : new Date();
  }

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: updateData,
  });

  // Update order status
  const orderStatus = mapDeliveryToOrderStatus(newStatus);
  if (orderStatus && delivery.Order.status !== orderStatus) {
    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: orderStatus },
    });
  }

  return NextResponse.json({
    received: true,
    awb,
    status: newStatus,
  });
}

function mapShiprocketTextStatus(status: string): DeliveryStatus {
  const statusLower = status.toLowerCase();

  if (statusLower.includes("delivered")) return "DELIVERED";
  if (statusLower.includes("out for delivery")) return "OUT_FOR_DELIVERY";
  if (statusLower.includes("in transit") || statusLower.includes("intransit")) return "IN_TRANSIT";
  if (statusLower.includes("picked") || statusLower.includes("pickup")) return "SHIPPED";
  if (statusLower.includes("rto delivered")) return "RTO_DELIVERED";
  if (statusLower.includes("rto") && statusLower.includes("transit")) return "RTO_IN_TRANSIT";
  if (statusLower.includes("rto")) return "RTO_INITIATED";
  if (statusLower.includes("cancel")) return "CANCELLED";
  if (statusLower.includes("manifest")) return "MANIFESTED";

  return "IN_TRANSIT";
}

function mapDelhiveryStatus(status: string): DeliveryStatus {
  // DeliveryStatus: PENDING, PACKED, MANIFESTED, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED
  const statusMap: Record<string, DeliveryStatus> = {
    Manifested: "MANIFESTED",
    "In Transit": "IN_TRANSIT",
    "Reached Destination Hub": "IN_TRANSIT",
    "Out for Delivery": "OUT_FOR_DELIVERY",
    Delivered: "DELIVERED",
    "Delivery Attempted": "OUT_FOR_DELIVERY",
    "RTO Initiated": "RTO_INITIATED",
    "RTO In-Transit": "RTO_IN_TRANSIT",
    "RTO Delivered": "RTO_DELIVERED",
    Cancelled: "CANCELLED",
    "Not Picked": "MANIFESTED",
    Pending: "PENDING",
  };

  return statusMap[status] || "IN_TRANSIT";
}

function mapDeliveryToOrderStatus(deliveryStatus: DeliveryStatus): OrderStatus | null {
  // OrderStatus: CREATED, CONFIRMED, ALLOCATED, PARTIALLY_ALLOCATED, PICKLIST_GENERATED, PICKING, PICKED, PACKING, PACKED, MANIFESTED, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED, ON_HOLD
  const statusMap: Record<string, OrderStatus> = {
    DELIVERED: "DELIVERED",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    IN_TRANSIT: "IN_TRANSIT",
    SHIPPED: "SHIPPED",
    RTO_INITIATED: "RTO_INITIATED",
    RTO_IN_TRANSIT: "RTO_IN_TRANSIT",
    RTO_DELIVERED: "RTO_DELIVERED",
    CANCELLED: "CANCELLED",
  };

  return statusMap[deliveryStatus] || null;
}
