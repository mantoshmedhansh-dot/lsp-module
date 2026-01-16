import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";
import { getCommunicationService } from "@/lib/services/communication";

// GET /api/proactive-communication - List scheduled and sent communications
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const trigger = searchParams.get("trigger") || "";
    const channel = searchParams.get("channel") || "";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Add company filter
    if (session.user.companyId) {
      where.companyId = session.user.companyId;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { Order: { orderNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (trigger) {
      where.trigger = trigger;
    }

    if (channel) {
      where.channel = channel;
    }

    if (fromDate) {
      where.createdAt = {
        ...(where.createdAt as object || {}),
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.createdAt = {
        ...(where.createdAt as object || {}),
        lte: new Date(toDate + "T23:59:59"),
      };
    }

    const [communications, total] = await Promise.all([
      prisma.proactiveCommunication.findMany({
        where,
        include: {
          Order: {
            select: {
              id: true,
              orderNo: true,
              customerName: true,
              status: true,
            },
          },
        },
        orderBy: [
          { scheduledFor: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.proactiveCommunication.count({ where }),
    ]);

    // Get status counts
    const companyFilter = where.companyId;
    const statusCounts = await prisma.proactiveCommunication.groupBy({
      by: ["status"],
      where: companyFilter ? { companyId: companyFilter as string } : undefined,
      _count: { _all: true },
    });

    const triggerCounts = await prisma.proactiveCommunication.groupBy({
      by: ["trigger"],
      where: companyFilter ? { companyId: companyFilter as string } : undefined,
      _count: { _all: true },
    });

    const channelCounts = await prisma.proactiveCommunication.groupBy({
      by: ["channel"],
      where: companyFilter ? { companyId: companyFilter as string } : undefined,
      _count: { _all: true },
    });

    // Compute delivery rates per channel
    const channels = ["WHATSAPP", "SMS", "EMAIL", "AI_VOICE", "IVR"];
    const channelDeliveryRates: Record<string, number> = {};

    for (const channel of channels) {
      const channelStats = await prisma.proactiveCommunication.groupBy({
        by: ["status"],
        where: {
          ...(companyFilter ? { companyId: companyFilter as string } : {}),
          channel: channel as "WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE" | "IVR" | "MANUAL_CALL",
        },
        _count: { _all: true },
      });

      const totalSent = channelStats.reduce((sum, s) => sum + s._count._all, 0);
      const delivered = channelStats
        .filter(s => ["DELIVERED", "READ", "RESPONDED"].includes(s.status))
        .reduce((sum, s) => sum + s._count._all, 0);

      channelDeliveryRates[channel] = totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0;
    }

    return NextResponse.json({
      communications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      triggerCounts: triggerCounts.reduce((acc, item) => {
        acc[item.trigger] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      channelCounts: channelCounts.reduce((acc, item) => {
        acc[item.channel] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      channelDeliveryRates,
    });
  } catch (error) {
    console.error("Error fetching proactive communications:", error);
    return NextResponse.json(
      { error: "Failed to fetch proactive communications" },
      { status: 500 }
    );
  }
}

// POST /api/proactive-communication - Create a scheduled communication
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      orderId,
      deliveryId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      trigger,
      channel,
      templateId,
      content,
      variables,
      scheduledFor,
      priority = 5,
      sendImmediately = false,
    } = body;

    // Validate required fields
    if (!customerName || !customerPhone || !trigger || !channel || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Determine company ID
    let companyId: string | undefined | null = session.user.companyId;
    if (orderId && !companyId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { Location: { select: { companyId: true } } },
      });
      companyId = order?.Location?.companyId;
    }

    // Create communication record
    const communication = await prisma.proactiveCommunication.create({
      data: {
        orderId,
        deliveryId,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        trigger: trigger as "ORDER_CONFIRMED" | "ORDER_SHIPPED" | "OUT_FOR_DELIVERY" | "DELAY_PREDICTED" | "SLA_BREACH_RISK" | "DELIVERY_ATTEMPTED" | "DELIVERED" | "FEEDBACK_REQUEST" | "CUSTOM",
        channel: channel as "WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE" | "MANUAL_CALL" | "IVR",
        templateId,
        content,
        variables,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        priority,
        status: sendImmediately ? "PENDING" : "SCHEDULED",
        companyId: companyId || "",
      },
      include: {
        Order: {
          select: {
            id: true,
            orderNo: true,
          },
        },
      },
    });

    // Send immediately if requested
    if (sendImmediately) {
      await sendProactiveCommunication(communication.id);
    }

    return NextResponse.json(communication, { status: 201 });
  } catch (error) {
    console.error("Error creating proactive communication:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create communication" },
      { status: 500 }
    );
  }
}

// Helper function to send a proactive communication
async function sendProactiveCommunication(communicationId: string) {
  const communication = await prisma.proactiveCommunication.findUnique({
    where: { id: communicationId },
  });

  if (!communication) return;

  const commService = getCommunicationService();

  // Check working hours
  if (!commService.isWithinWorkingHours()) {
    // Reschedule for next working hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    await prisma.proactiveCommunication.update({
      where: { id: communicationId },
      data: {
        scheduledFor: tomorrow,
        status: "SCHEDULED",
      },
    });
    return;
  }

  // Send based on channel
  const result = await commService.sendMessage(
    communication.channel as "WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE" | "MANUAL_CALL" | "IVR",
    {
      to: communication.channel === "EMAIL"
        ? communication.customerEmail || communication.customerPhone
        : communication.customerPhone,
      content: communication.content,
      templateId: communication.templateId || undefined,
      variables: communication.variables as Record<string, string> || undefined,
    }
  );

  // Update communication status
  await prisma.proactiveCommunication.update({
    where: { id: communicationId },
    data: {
      status: result.success ? "SENT" : "FAILED",
      sentAt: result.success ? new Date() : null,
      providerMessageId: result.providerMessageId,
      errorMessage: result.error,
    },
  });

  // Log AI action
  await prisma.aIActionLog.create({
    data: {
      entityType: "ProactiveCommunication",
      entityId: communicationId,
      actionType: "AUTO_SEND",
      actionDetails: {
        channel: communication.channel,
        trigger: communication.trigger,
        success: result.success,
        providerMessageId: result.providerMessageId,
      },
      status: result.success ? "SUCCESS" : "FAILED",
      executionError: result.error,
      companyId: communication.companyId,
    },
  });
}
