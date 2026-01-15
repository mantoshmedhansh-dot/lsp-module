import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";
import { getCommunicationService } from "@/lib/services/communication";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/proactive-communication/[id]/send - Send a scheduled communication immediately
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const communication = await prisma.proactiveCommunication.findUnique({
      where: { id },
    });

    if (!communication) {
      return NextResponse.json({ error: "Communication not found" }, { status: 404 });
    }

    // Check if already sent
    if (communication.status === "SENT" || communication.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Communication already sent" },
        { status: 400 }
      );
    }

    // Check if cancelled
    if (communication.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot send cancelled communication" },
        { status: 400 }
      );
    }

    const commService = getCommunicationService();

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
    const updatedComm = await prisma.proactiveCommunication.update({
      where: { id },
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
        entityId: id,
        actionType: "MANUAL_SEND",
        actionDetails: {
          channel: communication.channel,
          trigger: communication.trigger,
          success: result.success,
          providerMessageId: result.providerMessageId,
          sentBy: session.user.id || "MANUAL",
        },
        status: result.success ? "SUCCESS" : "FAILED",
        errorMessage: result.error,
        companyId: communication.companyId,
      },
    });

    return NextResponse.json({
      success: result.success,
      communication: updatedComm,
      message: result.success
        ? `Communication sent via ${communication.channel}`
        : `Failed to send: ${result.error}`,
    });
  } catch (error) {
    console.error("Error sending communication:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send communication" },
      { status: 500 }
    );
  }
}
