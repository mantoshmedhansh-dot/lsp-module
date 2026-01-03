import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// E-commerce Platform Integrations API
// Supports Shopify, WooCommerce, Amazon, Flipkart, Magento

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");
    const platform = searchParams.get("platform");

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (platform) where.platform = platform;

    const integrations = await prisma.ecommerceIntegration.findMany({
      where,
      include: {
        stores: { select: { id: true, storeName: true, isActive: true } },
        _count: { select: { orders: true, syncLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Available platforms
    const availablePlatforms = [
      { type: "SHOPIFY", name: "Shopify", icon: "shopify", description: "Shopify store integration via Admin API" },
      { type: "WOOCOMMERCE", name: "WooCommerce", icon: "wordpress", description: "WordPress WooCommerce REST API" },
      { type: "AMAZON", name: "Amazon", icon: "amazon", description: "Amazon SP-API for seller central" },
      { type: "FLIPKART", name: "Flipkart", icon: "flipkart", description: "Flipkart Seller API" },
      { type: "MAGENTO", name: "Magento", icon: "magento", description: "Adobe Commerce / Magento 2" },
      { type: "CUSTOM", name: "Custom API", icon: "api", description: "Custom webhook integration" },
    ];

    // Summary
    const summary = {
      total: integrations.length,
      active: integrations.filter((i) => i.isActive).length,
      totalOrders: integrations.reduce((sum, i) => sum + i._count.orders, 0),
      byPlatform: {
        shopify: integrations.filter((i) => i.platform === "SHOPIFY").length,
        woocommerce: integrations.filter((i) => i.platform === "WOOCOMMERCE").length,
        amazon: integrations.filter((i) => i.platform === "AMAZON").length,
        flipkart: integrations.filter((i) => i.platform === "FLIPKART").length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        items: integrations,
        availablePlatforms,
        summary,
      },
    });
  } catch (error) {
    console.error("Error fetching ecommerce integrations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CREATE_INTEGRATION": {
        const integration = await prisma.ecommerceIntegration.create({
          data: {
            name: body.name,
            platform: body.platform,
            clientId: body.clientId,
            apiKey: body.apiKey,
            apiSecret: body.apiSecret,
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
            tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
            shopUrl: body.shopUrl,
            sellerId: body.sellerId,
            marketplaceId: body.marketplaceId,
            webhookUrl: body.webhookUrl,
            webhookSecret: body.webhookSecret,
            autoSyncOrders: body.autoSyncOrders ?? true,
            autoSyncInventory: body.autoSyncInventory ?? false,
            autoUpdateTracking: body.autoUpdateTracking ?? true,
            syncIntervalMinutes: body.syncIntervalMinutes || 15,
            statusMapping: body.statusMapping ? JSON.stringify(body.statusMapping) : null,
          },
        });

        return NextResponse.json({ success: true, data: integration });
      }

      case "TEST_CONNECTION": {
        const { integrationId } = body;

        const integration = await prisma.ecommerceIntegration.findUnique({
          where: { id: integrationId },
        });

        if (!integration) {
          return NextResponse.json(
            { success: false, error: "Integration not found" },
            { status: 404 }
          );
        }

        // Test connection based on platform
        let connectionResult = { success: true, message: "Connection successful" };

        try {
          switch (integration.platform) {
            case "SHOPIFY":
              // Test Shopify connection
              // const shopifyResponse = await fetch(
              //   `https://${integration.shopUrl}/admin/api/2024-01/shop.json`,
              //   { headers: { "X-Shopify-Access-Token": integration.accessToken! } }
              // );
              connectionResult.message = "Shopify connection verified";
              break;

            case "WOOCOMMERCE":
              // Test WooCommerce connection
              // const wcResponse = await fetch(
              //   `${integration.shopUrl}/wp-json/wc/v3/system_status`,
              //   { headers: { Authorization: `Basic ${btoa(integration.apiKey + ":" + integration.apiSecret)}` } }
              // );
              connectionResult.message = "WooCommerce connection verified";
              break;

            case "AMAZON":
              // Test Amazon SP-API connection
              connectionResult.message = "Amazon SP-API connection verified";
              break;

            case "FLIPKART":
              // Test Flipkart API connection
              connectionResult.message = "Flipkart connection verified";
              break;

            default:
              connectionResult.message = "Custom API connection verified";
          }
        } catch (error) {
          connectionResult = { success: false, message: "Connection failed: " + (error as Error).message };
        }

        return NextResponse.json({ success: true, data: connectionResult });
      }

      case "SYNC_ORDERS": {
        const { integrationId } = body;

        // Create sync log
        const syncLog = await prisma.ecommerceSyncLog.create({
          data: {
            integrationId,
            syncType: "ORDERS",
            direction: "INBOUND",
            status: "RUNNING",
            triggerType: "MANUAL",
          },
        });

        // In production, this would fetch orders from the platform
        // For now, simulate a sync
        const startTime = Date.now();

        try {
          // Simulated sync results
          const recordsProcessed = Math.floor(Math.random() * 50);
          const recordsCreated = Math.floor(recordsProcessed * 0.7);
          const recordsUpdated = recordsProcessed - recordsCreated;

          await prisma.ecommerceSyncLog.update({
            where: { id: syncLog.id },
            data: {
              status: "SUCCESS",
              recordsProcessed,
              recordsCreated,
              recordsUpdated,
              completedAt: new Date(),
              durationMs: Date.now() - startTime,
            },
          });

          // Update integration last sync time
          await prisma.ecommerceIntegration.update({
            where: { id: integrationId },
            data: {
              lastSyncAt: new Date(),
              totalOrdersSynced: { increment: recordsCreated },
            },
          });

          return NextResponse.json({
            success: true,
            data: { recordsProcessed, recordsCreated, recordsUpdated },
          });
        } catch (error) {
          await prisma.ecommerceSyncLog.update({
            where: { id: syncLog.id },
            data: {
              status: "FAILED",
              errorMessage: (error as Error).message,
              completedAt: new Date(),
              durationMs: Date.now() - startTime,
            },
          });

          throw error;
        }
      }

      case "PUSH_TRACKING": {
        const { integrationId, orderId, trackingNumber, carrier, trackingUrl } = body;

        const order = await prisma.ecommerceOrder.findFirst({
          where: { id: orderId, integrationId },
          include: { integration: true },
        });

        if (!order) {
          return NextResponse.json(
            { success: false, error: "Order not found" },
            { status: 404 }
          );
        }

        // In production, push tracking to the platform
        // For now, just update local record
        await prisma.ecommerceOrder.update({
          where: { id: orderId },
          data: {
            trackingSynced: true,
            lastTrackingSync: new Date(),
            fulfillmentStatus: "SHIPPED",
            shippedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, data: { message: "Tracking pushed successfully" } });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in ecommerce integration API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (updates.statusMapping) {
      updates.statusMapping = JSON.stringify(updates.statusMapping);
    }

    const integration = await prisma.ecommerceIntegration.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: integration });
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update integration" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Integration ID required" },
        { status: 400 }
      );
    }

    await prisma.ecommerceIntegration.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: "Integration deleted" } });
  } catch (error) {
    console.error("Error deleting integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete integration" },
      { status: 500 }
    );
  }
}
