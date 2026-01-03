import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// E-commerce Orders API
// Manages orders synced from Shopify, WooCommerce, Amazon, Flipkart

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const integrationId = searchParams.get("integrationId");
    const fulfillmentStatus = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};
    if (integrationId) where.integrationId = integrationId;
    if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
    if (search) {
      where.OR = [
        { platformOrderNumber: { contains: search } },
        { customerName: { contains: search } },
        { awbNumber: { contains: search } },
      ];
    }

    const orders = await prisma.ecommerceOrder.findMany({
      where,
      include: {
        integration: { select: { name: true, platform: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 100,
    });

    // Summary
    const summary = {
      pending: await prisma.ecommerceOrder.count({ where: { ...where, fulfillmentStatus: "PENDING" } }),
      processing: await prisma.ecommerceOrder.count({ where: { ...where, fulfillmentStatus: "PROCESSING" } }),
      shipped: await prisma.ecommerceOrder.count({ where: { ...where, fulfillmentStatus: "SHIPPED" } }),
      delivered: await prisma.ecommerceOrder.count({ where: { ...where, fulfillmentStatus: "DELIVERED" } }),
      cancelled: await prisma.ecommerceOrder.count({ where: { ...where, fulfillmentStatus: "CANCELLED" } }),
    };

    return NextResponse.json({
      success: true,
      data: { items: orders, summary },
    });
  } catch (error) {
    console.error("Error fetching ecommerce orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CREATE_SHIPMENT": {
        // Create a CJDQuick shipment from an ecommerce order
        const { orderId } = body;

        const ecomOrder = await prisma.ecommerceOrder.findUnique({
          where: { id: orderId },
          include: { integration: true },
        });

        if (!ecomOrder) {
          return NextResponse.json(
            { success: false, error: "Order not found" },
            { status: 404 }
          );
        }

        // Generate AWB
        const awbNumber = `CJD${Date.now().toString(36).toUpperCase()}`;

        // Create shipment (this would link to the main Shipment model)
        // For now, just update the ecommerce order
        await prisma.ecommerceOrder.update({
          where: { id: orderId },
          data: {
            awbNumber,
            fulfillmentStatus: "PROCESSING",
          },
        });

        return NextResponse.json({
          success: true,
          data: { awbNumber, message: "Shipment created successfully" },
        });
      }

      case "BULK_CREATE_SHIPMENTS": {
        const { orderIds } = body;

        const results = [];
        for (const orderId of orderIds) {
          try {
            const awbNumber = `CJD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 4)}`;

            await prisma.ecommerceOrder.update({
              where: { id: orderId },
              data: {
                awbNumber,
                fulfillmentStatus: "PROCESSING",
              },
            });

            results.push({ orderId, awbNumber, success: true });
          } catch (error) {
            results.push({ orderId, success: false, error: (error as Error).message });
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            processed: results.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
          },
        });
      }

      case "UPDATE_FULFILLMENT": {
        const { orderId, status, trackingNumber, carrier } = body;

        const order = await prisma.ecommerceOrder.update({
          where: { id: orderId },
          data: {
            fulfillmentStatus: status,
            awbNumber: trackingNumber || undefined,
            shippedAt: status === "SHIPPED" ? new Date() : undefined,
            deliveredAt: status === "DELIVERED" ? new Date() : undefined,
          },
        });

        return NextResponse.json({ success: true, data: order });
      }

      case "SYNC_TRACKING_STATUS": {
        // Sync tracking status from CJDQuick shipment to ecommerce platform
        const { orderId } = body;

        const order = await prisma.ecommerceOrder.findUnique({
          where: { id: orderId },
          include: { integration: true },
        });

        if (!order || !order.awbNumber) {
          return NextResponse.json(
            { success: false, error: "Order or tracking not found" },
            { status: 404 }
          );
        }

        // In production, this would:
        // 1. Fetch tracking status from CJDQuick shipment
        // 2. Push status update to the ecommerce platform

        await prisma.ecommerceOrder.update({
          where: { id: orderId },
          data: {
            trackingSynced: true,
            lastTrackingSync: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          data: { message: "Tracking synced to platform" },
        });
      }

      case "IMPORT_ORDER": {
        // Manually import an order from platform data
        const { integrationId, orderData } = body;

        const order = await prisma.ecommerceOrder.create({
          data: {
            integrationId,
            platformOrderId: orderData.platformOrderId,
            platformOrderNumber: orderData.platformOrderNumber,
            platformStatus: orderData.platformStatus,
            orderDate: new Date(orderData.orderDate),
            currency: orderData.currency || "INR",
            subtotal: orderData.subtotal || 0,
            shippingCost: orderData.shippingCost || 0,
            taxAmount: orderData.taxAmount || 0,
            discount: orderData.discount || 0,
            totalAmount: orderData.totalAmount || 0,
            customerName: orderData.customerName,
            customerEmail: orderData.customerEmail,
            customerPhone: orderData.customerPhone,
            shippingName: orderData.shippingName,
            shippingAddress1: orderData.shippingAddress1,
            shippingAddress2: orderData.shippingAddress2,
            shippingCity: orderData.shippingCity,
            shippingState: orderData.shippingState,
            shippingPincode: orderData.shippingPincode,
            shippingCountry: orderData.shippingCountry || "IN",
            shippingPhone: orderData.shippingPhone,
            lineItems: JSON.stringify(orderData.lineItems || []),
            itemCount: orderData.itemCount || 1,
            totalWeight: orderData.totalWeight || 0,
            paymentMethod: orderData.paymentMethod,
            paymentStatus: orderData.paymentStatus,
            isCod: orderData.isCod || false,
            rawOrderData: JSON.stringify(orderData),
          },
        });

        return NextResponse.json({ success: true, data: order });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in ecommerce orders API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
