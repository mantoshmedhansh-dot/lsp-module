import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Supported payment gateways
const GATEWAY_CONFIGS = {
  RAZORPAY: {
    name: "Razorpay",
    displayName: "Razorpay",
    apiUrl: "https://api.razorpay.com/v1",
    testApiUrl: "https://api.razorpay.com/v1",
    supportsCreditCard: true,
    supportsDebitCard: true,
    supportsNetBanking: true,
    supportsUPI: true,
    supportsWallet: true,
    supportsEMI: true,
    supportsQRCode: true,
  },
  PAYU: {
    name: "PayU",
    displayName: "PayU Money",
    apiUrl: "https://secure.payu.in",
    testApiUrl: "https://sandboxsecure.payu.in",
    supportsCreditCard: true,
    supportsDebitCard: true,
    supportsNetBanking: true,
    supportsUPI: true,
    supportsWallet: true,
    supportsEMI: true,
    supportsQRCode: false,
  },
  CCAVENUE: {
    name: "CCAvenue",
    displayName: "CCAvenue",
    apiUrl: "https://secure.ccavenue.com",
    testApiUrl: "https://test.ccavenue.com",
    supportsCreditCard: true,
    supportsDebitCard: true,
    supportsNetBanking: true,
    supportsUPI: false,
    supportsWallet: true,
    supportsEMI: true,
    supportsQRCode: false,
  },
  PHONEPE: {
    name: "PhonePe",
    displayName: "PhonePe Business",
    apiUrl: "https://api.phonepe.com/apis/hermes",
    testApiUrl: "https://api-preprod.phonepe.com/apis/pg-sandbox",
    supportsCreditCard: true,
    supportsDebitCard: true,
    supportsNetBanking: false,
    supportsUPI: true,
    supportsWallet: true,
    supportsEMI: false,
    supportsQRCode: true,
  },
};

// GET - List payment gateways
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const gatewayType = searchParams.get("gatewayType");
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (gatewayType) where.gatewayType = gatewayType;
    if (isActive !== null) where.isActive = isActive === "true";

    const gateways = await prisma.paymentGateway.findMany({
      where,
      include: {
        _count: {
          select: { transactions: true, settlements: true },
        },
        client: {
          select: { id: true, companyName: true },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { priority: "asc" }],
    });

    // Mask sensitive data
    const maskedGateways = gateways.map((g) => ({
      ...g,
      apiKey: g.apiKey ? `${g.apiKey.substring(0, 8)}...` : null,
      apiSecret: "********",
      webhookSecret: g.webhookSecret ? "********" : null,
      salt: g.salt ? "********" : null,
    }));

    // Get available gateway types
    const availableTypes = Object.entries(GATEWAY_CONFIGS).map(([type, config]) => ({
      type,
      ...config,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: maskedGateways,
        availableTypes,
      },
    });
  } catch (error) {
    console.error("Payment Gateway GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payment gateways" },
      { status: 500 }
    );
  }
}

// POST - Create payment gateway
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      gatewayType,
      apiKey,
      apiSecret,
      merchantId,
      salt,
      mode = "TEST",
      isPrimary = false,
      webhookUrl,
      webhookSecret,
      transactionFeePercent = 2,
      flatFeePerTxn = 0,
      minimumAmount = 1,
      maximumAmount = 10000000,
    } = body;

    // Validate gateway type
    if (!gatewayType || !GATEWAY_CONFIGS[gatewayType as keyof typeof GATEWAY_CONFIGS]) {
      return NextResponse.json(
        { success: false, error: `Invalid gateway type. Supported: ${Object.keys(GATEWAY_CONFIGS).join(", ")}` },
        { status: 400 }
      );
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, error: "API key and secret are required" },
        { status: 400 }
      );
    }

    const config = GATEWAY_CONFIGS[gatewayType as keyof typeof GATEWAY_CONFIGS];

    // If setting as primary, unset other primary gateways
    if (isPrimary) {
      await prisma.paymentGateway.updateMany({
        where: { clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const gateway = await prisma.paymentGateway.create({
      data: {
        clientId,
        gatewayType,
        gatewayName: config.name,
        displayName: config.displayName,
        apiKey,
        apiSecret,
        merchantId,
        salt,
        mode,
        isActive: true,
        isPrimary,
        webhookUrl,
        webhookSecret,
        transactionFeePercent,
        flatFeePerTxn,
        minimumAmount,
        maximumAmount,
        supportsCreditCard: config.supportsCreditCard,
        supportsDebitCard: config.supportsDebitCard,
        supportsNetBanking: config.supportsNetBanking,
        supportsUPI: config.supportsUPI,
        supportsWallet: config.supportsWallet,
        supportsEMI: config.supportsEMI,
        supportsQRCode: config.supportsQRCode,
        healthStatus: "HEALTHY",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...gateway,
        apiKey: `${gateway.apiKey.substring(0, 8)}...`,
        apiSecret: "********",
      },
      message: `${config.displayName} gateway configured successfully`,
    });
  } catch (error) {
    console.error("Payment Gateway POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create payment gateway" },
      { status: 500 }
    );
  }
}

// PATCH - Update payment gateway
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Gateway ID is required" },
        { status: 400 }
      );
    }

    const gateway = await prisma.paymentGateway.findUnique({
      where: { id },
    });

    if (!gateway) {
      return NextResponse.json(
        { success: false, error: "Payment gateway not found" },
        { status: 404 }
      );
    }

    if (action === "TOGGLE_ACTIVE") {
      const updated = await prisma.paymentGateway.update({
        where: { id },
        data: { isActive: !gateway.isActive },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Gateway ${updated.isActive ? "activated" : "deactivated"}`,
      });
    }

    if (action === "SET_PRIMARY") {
      // Unset other primary gateways for this client
      await prisma.paymentGateway.updateMany({
        where: { clientId: gateway.clientId, isPrimary: true },
        data: { isPrimary: false },
      });

      const updated = await prisma.paymentGateway.update({
        where: { id },
        data: { isPrimary: true },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Gateway set as primary",
      });
    }

    if (action === "TEST_CONNECTION") {
      // Simulate connection test (in production, make actual API call)
      const isHealthy = Math.random() > 0.1; // 90% success rate for demo

      const updated = await prisma.paymentGateway.update({
        where: { id },
        data: {
          lastHealthCheckAt: new Date(),
          healthStatus: isHealthy ? "HEALTHY" : "DEGRADED",
          lastErrorMessage: isHealthy ? null : "Connection timeout",
          lastErrorAt: isHealthy ? null : new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: isHealthy ? "Connection successful" : "Connection failed",
      });
    }

    // General update
    const updateData: any = {};
    if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;
    if (data.webhookSecret !== undefined) updateData.webhookSecret = data.webhookSecret;
    if (data.transactionFeePercent !== undefined) updateData.transactionFeePercent = data.transactionFeePercent;
    if (data.flatFeePerTxn !== undefined) updateData.flatFeePerTxn = data.flatFeePerTxn;
    if (data.minimumAmount !== undefined) updateData.minimumAmount = data.minimumAmount;
    if (data.maximumAmount !== undefined) updateData.maximumAmount = data.maximumAmount;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.priority !== undefined) updateData.priority = data.priority;

    // Update credentials if provided
    if (data.apiKey) updateData.apiKey = data.apiKey;
    if (data.apiSecret) updateData.apiSecret = data.apiSecret;
    if (data.merchantId !== undefined) updateData.merchantId = data.merchantId;
    if (data.salt !== undefined) updateData.salt = data.salt;

    const updated = await prisma.paymentGateway.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        apiKey: `${updated.apiKey.substring(0, 8)}...`,
        apiSecret: "********",
      },
      message: "Gateway updated",
    });
  } catch (error) {
    console.error("Payment Gateway PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update payment gateway" },
      { status: 500 }
    );
  }
}

// DELETE - Remove payment gateway
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Gateway ID is required" },
        { status: 400 }
      );
    }

    const gateway = await prisma.paymentGateway.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } },
    });

    if (!gateway) {
      return NextResponse.json(
        { success: false, error: "Payment gateway not found" },
        { status: 404 }
      );
    }

    if (gateway._count.transactions > 0) {
      // Soft delete - just deactivate
      await prisma.paymentGateway.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Gateway deactivated (has transaction history)",
      });
    }

    await prisma.paymentGateway.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Gateway deleted",
    });
  } catch (error) {
    console.error("Payment Gateway DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete payment gateway" },
      { status: 500 }
    );
  }
}
