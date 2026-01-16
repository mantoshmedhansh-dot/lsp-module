import { NextRequest, NextResponse } from "next/server";
import { prisma, Channel, PaymentMode, OrderStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/integrations/channels/sync - Sync orders from marketplace
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { channelConfigId, fromDate, toDate, orderIds } = body;

    if (!channelConfigId) {
      return NextResponse.json(
        { error: "Channel config ID is required" },
        { status: 400 }
      );
    }

    // Get channel config
    const channelConfig = await prisma.channelConfig.findUnique({
      where: { id: channelConfigId },
      include: {
        Company: {
          include: {
            Location: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!channelConfig) {
      return NextResponse.json(
        { error: "Channel config not found" },
        { status: 404 }
      );
    }

    if (!channelConfig.isActive) {
      return NextResponse.json(
        { error: "Channel is not active" },
        { status: 400 }
      );
    }

    // Get orders based on channel type
    let orders: MarketplaceOrder[] = [];
    const syncErrors: { orderId: string; error: string }[] = [];

    try {
      switch (channelConfig.channel) {
        case "SHOPIFY":
          orders = await fetchShopifyOrders(channelConfig, fromDate, toDate, orderIds);
          break;
        case "FLIPKART":
          orders = await fetchFlipkartOrders(channelConfig, fromDate, toDate, orderIds);
          break;
        case "AMAZON":
          orders = await fetchAmazonOrders(channelConfig, fromDate, toDate, orderIds);
          break;
        default:
          return NextResponse.json(
            { error: `Channel ${channelConfig.channel} sync not supported` },
            { status: 400 }
          );
      }
    } catch (fetchError) {
      console.error("Error fetching orders from channel:", fetchError);
      return NextResponse.json(
        { error: `Failed to fetch orders from ${channelConfig.channel}` },
        { status: 500 }
      );
    }

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new orders found",
        synced: 0,
        errors: [],
      });
    }

    // Process each order
    const createdOrders: string[] = [];

    for (const marketplaceOrder of orders) {
      try {
        // Check if order already exists
        const existing = await prisma.order.findFirst({
          where: {
            OR: [
              { externalOrderNo: marketplaceOrder.orderId },
              { orderNo: marketplaceOrder.orderId },
            ],
          },
        });

        if (existing) {
          syncErrors.push({
            orderId: marketplaceOrder.orderId,
            error: "Order already exists",
          });
          continue;
        }

        // Validate SKUs
        const skuCodes = marketplaceOrder.items.map((i) => i.skuCode);
        const skus = await prisma.sKU.findMany({
          where: { code: { in: skuCodes } },
        });

        const skuMap = new Map(skus.map((s) => [s.code, s]));
        const missingSKUs = skuCodes.filter((code) => !skuMap.has(code));

        if (missingSKUs.length > 0) {
          syncErrors.push({
            orderId: marketplaceOrder.orderId,
            error: `SKUs not found: ${missingSKUs.join(", ")}`,
          });
          continue;
        }

        // Generate order number
        const sequence = await prisma.sequence.upsert({
          where: { name: "order" },
          update: { currentValue: { increment: 1 } },
          create: { name: "order", prefix: "ORD", currentValue: 1 },
        });

        const orderNo = `ORD${String(sequence.currentValue).padStart(8, "0")}`;

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;

        const items = marketplaceOrder.items.map((item) => {
          const sku = skuMap.get(item.skuCode)!;
          const itemTotal = item.quantity * item.unitPrice;
          subtotal += itemTotal;
          totalTax += item.taxAmount || 0;

          return {
            skuId: sku.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.taxAmount || 0,
            discount: item.discount || 0,
            totalPrice: itemTotal + (item.taxAmount || 0) - (item.discount || 0),
          };
        });

        const shippingCharges = marketplaceOrder.shippingCharges || 0;
        const discount = marketplaceOrder.discount || 0;
        const totalAmount = subtotal + totalTax + shippingCharges - discount;

        // Create order
        const order = await prisma.order.create({
          data: {
            orderNo,
            externalOrderNo: marketplaceOrder.orderId,
            channel: channelConfig.channel as Channel,
            paymentMode: marketplaceOrder.paymentMode as PaymentMode,
            status: "PENDING" as OrderStatus,
            customerName: marketplaceOrder.customerName,
            customerPhone: marketplaceOrder.customerPhone,
            customerEmail: marketplaceOrder.customerEmail,
            shippingAddress: {
              name: marketplaceOrder.shippingAddress.name,
              phone: marketplaceOrder.shippingAddress.phone,
              addressLine1: marketplaceOrder.shippingAddress.addressLine1,
              addressLine2: marketplaceOrder.shippingAddress.addressLine2,
              city: marketplaceOrder.shippingAddress.city,
              state: marketplaceOrder.shippingAddress.state,
              pincode: marketplaceOrder.shippingAddress.pincode,
              country: marketplaceOrder.shippingAddress.country || "India",
            },
            orderDate: new Date(marketplaceOrder.orderDate),
            subtotal,
            taxAmount: totalTax,
            shippingCharges,
            discount,
            totalAmount,
            locationId: body.locationId || channelConfig.Company.Location[0]?.id,
            dataSourceType: "CHANNEL_SYNC",
            OrderItem: {
              create: items,
            },
          },
        });

        createdOrders.push(order.id);
      } catch (orderError) {
        syncErrors.push({
          orderId: marketplaceOrder.orderId,
          error: orderError instanceof Error ? orderError.message : "Unknown error",
        });
      }
    }

    // Update channel config last sync time
    await prisma.channelConfig.update({
      where: { id: channelConfigId },
      data: {
        syncStatus: syncErrors.length === 0 ? "COMPLETED" : "FAILED",
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      success: syncErrors.length === 0,
      message: `Synced ${createdOrders.length} orders from ${channelConfig.channel}`,
      synced: createdOrders.length,
      total: orders.length,
      errors: syncErrors.slice(0, 50),
    });
  } catch (error) {
    console.error("Error syncing orders:", error);
    return NextResponse.json(
      { error: "Failed to sync orders" },
      { status: 500 }
    );
  }
}

// Type definitions
interface MarketplaceOrder {
  orderId: string;
  orderDate: string;
  paymentMode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  items: {
    skuCode: string;
    quantity: number;
    unitPrice: number;
    taxAmount?: number;
    discount?: number;
  }[];
  shippingCharges?: number;
  discount?: number;
}

interface ChannelConfigData {
  channel: string;
  credentials: unknown;
  locationId?: string | null;
}

// Channel-specific fetch functions (placeholder implementations)
async function fetchShopifyOrders(
  config: ChannelConfigData,
  fromDate?: string,
  toDate?: string,
  orderIds?: string[]
): Promise<MarketplaceOrder[]> {
  const credentials = config.credentials as {
    shopDomain?: string;
    accessToken?: string;
  };

  if (!credentials.shopDomain || !credentials.accessToken) {
    throw new Error("Shopify credentials not configured");
  }

  // Build query params
  const params = new URLSearchParams({
    status: "any",
    limit: "250",
  });

  if (fromDate) {
    params.append("created_at_min", new Date(fromDate).toISOString());
  }
  if (toDate) {
    params.append("created_at_max", new Date(toDate).toISOString());
  }
  if (orderIds && orderIds.length > 0) {
    params.append("ids", orderIds.join(","));
  }

  const response = await fetch(
    `https://${credentials.shopDomain}/admin/api/2024-01/orders.json?${params}`,
    {
      headers: {
        "X-Shopify-Access-Token": credentials.accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
  const orders: MarketplaceOrder[] = [];

  for (const order of data.orders || []) {
    orders.push({
      orderId: order.name || order.id.toString(),
      orderDate: order.created_at,
      paymentMode: order.financial_status === "paid" ? "PREPAID" : "COD",
      customerName: order.shipping_address?.name || order.customer?.first_name || "",
      customerPhone: order.shipping_address?.phone || order.customer?.phone || "",
      customerEmail: order.email,
      shippingAddress: {
        name: order.shipping_address?.name || "",
        phone: order.shipping_address?.phone || "",
        addressLine1: order.shipping_address?.address1 || "",
        addressLine2: order.shipping_address?.address2,
        city: order.shipping_address?.city || "",
        state: order.shipping_address?.province || "",
        pincode: order.shipping_address?.zip || "",
        country: order.shipping_address?.country || "India",
      },
      items: (order.line_items || []).map((item: { sku?: string; quantity: number; price: string; tax_lines?: { price: string }[] }) => ({
        skuCode: item.sku || "",
        quantity: item.quantity,
        unitPrice: parseFloat(item.price),
        taxAmount: item.tax_lines?.reduce((sum: number, t: { price: string }) => sum + parseFloat(t.price), 0) || 0,
      })),
      shippingCharges: order.shipping_lines?.reduce(
        (sum: number, s: { price: string }) => sum + parseFloat(s.price),
        0
      ) || 0,
      discount: Math.abs(parseFloat(order.total_discounts || "0")),
    });
  }

  return orders;
}

async function fetchFlipkartOrders(
  config: ChannelConfigData,
  fromDate?: string,
  toDate?: string,
  orderIds?: string[]
): Promise<MarketplaceOrder[]> {
  const credentials = config.credentials as {
    applicationId?: string;
    applicationSecret?: string;
  };

  if (!credentials.applicationId || !credentials.applicationSecret) {
    throw new Error("Flipkart credentials not configured");
  }

  // Flipkart API implementation placeholder
  // In production, implement proper OAuth and API calls
  console.log("Flipkart sync requested", { fromDate, toDate, orderIds });

  // Return empty array - implement actual API integration
  return [];
}

async function fetchAmazonOrders(
  config: ChannelConfigData,
  fromDate?: string,
  toDate?: string,
  orderIds?: string[]
): Promise<MarketplaceOrder[]> {
  const credentials = config.credentials as {
    sellerId?: string;
    mwsAuthToken?: string;
    refreshToken?: string;
  };

  if (!credentials.sellerId) {
    throw new Error("Amazon credentials not configured");
  }

  // Amazon SP-API implementation placeholder
  // In production, implement proper LWA OAuth and SP-API calls
  console.log("Amazon sync requested", { fromDate, toDate, orderIds });

  // Return empty array - implement actual API integration
  return [];
}
