import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";

// Helper to generate NDR code
function generateNDRCode(): string {
  const prefix = "NDR";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// AI Classification for NDR reasons
function classifyNDRReason(carrierRemark: string): {
  reason: string;
  classification: string;
  confidence: number;
  priority: string;
  riskScore: number;
} {
  const remark = carrierRemark.toLowerCase();

  // Customer not available patterns
  if (remark.includes("not available") || remark.includes("customer unavailable") || remark.includes("no one home") || remark.includes("door locked")) {
    return {
      reason: "CUSTOMER_NOT_AVAILABLE",
      classification: "Customer was not present at delivery location",
      confidence: 0.92,
      priority: "MEDIUM",
      riskScore: 45,
    };
  }

  // Wrong address patterns
  if (remark.includes("wrong address") || remark.includes("address not found") || remark.includes("incomplete address") || remark.includes("landmark not found")) {
    return {
      reason: "WRONG_ADDRESS",
      classification: "Delivery address is incorrect or incomplete",
      confidence: 0.95,
      priority: "HIGH",
      riskScore: 75,
    };
  }

  // Phone unreachable patterns
  if (remark.includes("phone off") || remark.includes("not reachable") || remark.includes("wrong number") || remark.includes("switched off")) {
    return {
      reason: "PHONE_UNREACHABLE",
      classification: "Customer phone is switched off or unreachable",
      confidence: 0.90,
      priority: "HIGH",
      riskScore: 70,
    };
  }

  // Refused patterns
  if (remark.includes("refused") || remark.includes("rejected") || remark.includes("cancelled by customer") || remark.includes("customer denied")) {
    return {
      reason: "REFUSED",
      classification: "Customer refused to accept delivery",
      confidence: 0.98,
      priority: "CRITICAL",
      riskScore: 95,
    };
  }

  // COD not ready patterns
  if (remark.includes("cod not ready") || remark.includes("no cash") || remark.includes("payment issue") || remark.includes("amount not ready")) {
    return {
      reason: "COD_NOT_READY",
      classification: "Customer did not have COD amount ready",
      confidence: 0.93,
      priority: "MEDIUM",
      riskScore: 40,
    };
  }

  // Reschedule patterns
  if (remark.includes("reschedule") || remark.includes("out of town") || remark.includes("request callback") || remark.includes("tomorrow") || remark.includes("customer busy")) {
    return {
      reason: "CUSTOMER_RESCHEDULE",
      classification: "Customer requested delivery reschedule",
      confidence: 0.88,
      priority: "LOW",
      riskScore: 25,
    };
  }

  // Default - unclassified
  return {
    reason: "OTHER",
    classification: "Unclassified delivery exception",
    confidence: 0.60,
    priority: "MEDIUM",
    riskScore: 50,
  };
}

// POST /api/ndr/webhook - Receive NDR from carrier webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support multiple carrier formats
    // Check for carrier-specific headers or body fields to determine format
    const carrierHeader = request.headers.get("x-carrier-source") || "";
    const isClickPost = body.event === "ndr" || body.cp_id;
    const isDelhivery = body.Docket || body.docket;
    const isBlueDart = body.AWBNo && body.StatusType === "NDR";
    const isEkart = body.tracking_id && body.status_code?.includes("NDR");

    let deliveryId: string | undefined;
    let awbNo: string;
    let carrierNDRCode: string;
    let carrierRemark: string;
    let attemptNumber: number;
    let attemptDate: Date;

    // Parse based on carrier format
    if (isClickPost) {
      // ClickPost aggregator format
      awbNo = body.waybill || body.awb;
      carrierNDRCode = body.ndr_id || body.event_id;
      carrierRemark = body.remark || body.ndr_remark || body.status_description;
      attemptNumber = body.attempt_count || body.attempts || 1;
      attemptDate = body.timestamp ? new Date(body.timestamp) : new Date();
    } else if (isDelhivery) {
      // Delhivery format
      awbNo = body.Docket || body.docket || body.waybill;
      carrierNDRCode = body.ScanId || body.scan_id;
      carrierRemark = body.Instructions || body.instructions || body.Reason;
      attemptNumber = body.AttemptCount || body.attempt_count || 1;
      attemptDate = body.StatusDateTime ? new Date(body.StatusDateTime) : new Date();
    } else if (isBlueDart) {
      // BlueDart format
      awbNo = body.AWBNo || body.awbno;
      carrierNDRCode = body.StatusCode || body.status_code;
      carrierRemark = body.StatusRemarks || body.Remarks;
      attemptNumber = parseInt(body.AttemptNo || "1");
      attemptDate = body.StatusDate ? new Date(body.StatusDate) : new Date();
    } else if (isEkart) {
      // Ekart format
      awbNo = body.tracking_id;
      carrierNDRCode = body.ndr_code || body.status_code;
      carrierRemark = body.ndr_reason || body.status_description;
      attemptNumber = body.attempt_no || 1;
      attemptDate = body.event_time ? new Date(body.event_time) : new Date();
    } else {
      // Generic format (default)
      awbNo = body.awb || body.awbNo || body.waybill || body.tracking_no;
      carrierNDRCode = body.ndr_code || body.ndrCode || body.ref_no;
      carrierRemark = body.remark || body.reason || body.remarks || body.description;
      attemptNumber = body.attempt || body.attemptNumber || 1;
      attemptDate = body.date ? new Date(body.date) : new Date();
    }

    if (!awbNo) {
      return NextResponse.json(
        { error: "AWB number not found in webhook payload" },
        { status: 400 }
      );
    }

    // Find delivery by AWB number
    const delivery = await prisma.delivery.findFirst({
      where: { awbNo },
      include: {
        Order: {
          include: {
            Location: true,
          },
        },
      },
    });

    if (!delivery) {
      // Log unknown AWB but don't fail - carrier may send before we have the record
      console.warn(`NDR webhook received for unknown AWB: ${awbNo}`);
      return NextResponse.json({
        status: "accepted",
        message: "AWB not found in system, webhook logged",
      });
    }

    deliveryId = delivery.id;

    // Check if NDR already exists for this delivery and attempt
    const existingNDR = await prisma.nDR.findFirst({
      where: {
        deliveryId,
        attemptNumber,
      },
    });

    if (existingNDR) {
      // Update existing NDR with new info
      await prisma.nDR.update({
        where: { id: existingNDR.id },
        data: {
          carrierRemark,
          attemptDate,
        },
      });

      return NextResponse.json({
        status: "updated",
        ndrId: existingNDR.id,
        message: "Existing NDR updated",
      });
    }

    // AI classify the NDR reason
    const classification = classifyNDRReason(carrierRemark || "");

    // Create NDR record
    const ndr = await prisma.nDR.create({
      data: {
        ndrCode: generateNDRCode(),
        deliveryId,
        orderId: delivery.orderId,
        carrierNDRCode,
        carrierRemark,
        attemptNumber,
        attemptDate,
        reason: classification.reason as "CUSTOMER_NOT_AVAILABLE" | "WRONG_ADDRESS" | "PHONE_UNREACHABLE" | "REFUSED" | "COD_NOT_READY" | "CUSTOMER_RESCHEDULE" | "OTHER",
        aiClassification: classification.classification,
        confidence: classification.confidence,
        status: "OPEN",
        priority: classification.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        riskScore: classification.riskScore,
        companyId: delivery.Order.Location.companyId,
      },
    });

    // Update delivery status to NDR
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: "NDR" },
    });

    // Log AI action
    await prisma.aIActionLog.create({
      data: {
        entityType: "NDR",
        entityId: ndr.id,
        ndrId: ndr.id,
        actionType: "AUTO_CLASSIFY",
        actionDetails: {
          source: "webhook",
          carrier: carrierHeader || "unknown",
          carrierRemark,
          classifiedReason: classification.reason,
          confidence: classification.confidence,
          priority: classification.priority,
          riskScore: classification.riskScore,
        },
        status: "SUCCESS",
        confidence: classification.confidence,
        processingTime: 25,
        companyId: ndr.companyId,
      },
    });

    // Trigger automated outreach based on priority (async, don't wait)
    triggerAutomatedOutreach(ndr.id, classification.priority).catch((err) => {
      console.error("Error in automated outreach:", err);
    });

    return NextResponse.json({
      status: "created",
      ndrId: ndr.id,
      ndrCode: ndr.ndrCode,
      classification: {
        reason: classification.reason,
        confidence: classification.confidence,
        priority: classification.priority,
      },
    });
  } catch (error) {
    console.error("Error processing NDR webhook:", error);
    return NextResponse.json(
      { error: "Failed to process NDR webhook" },
      { status: 500 }
    );
  }
}

// Automated outreach based on priority
async function triggerAutomatedOutreach(ndrId: string, priority: string) {
  const ndr = await prisma.nDR.findUnique({
    where: { id: ndrId },
    include: {
      Order: true,
    },
  });

  if (!ndr) return;

  // Import services dynamically to avoid circular dependencies
  const { getWhatsAppService } = await import("@/lib/services/communication/whatsapp-service");

  const whatsappService = getWhatsAppService();

  // Immediate outreach for HIGH and CRITICAL priority
  if (priority === "CRITICAL" || priority === "HIGH") {
    // Check if within working hours (9 AM - 9 PM)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 21) {
      const result = await whatsappService.sendNDRResolutionMessage(
        ndr.Order.customerPhone,
        ndr.Order.orderNo,
        ndr.aiClassification || ndr.reason
      );

      // Record outreach attempt
      await prisma.nDROutreach.create({
        data: {
          ndrId,
          channel: "WHATSAPP",
          attemptNumber: 1,
          messageContent: "Automated NDR resolution message",
          status: result.success ? "SENT" : "FAILED",
          sentAt: result.success ? new Date() : null,
          providerMessageId: result.providerMessageId,
          errorMessage: result.error,
        },
      });

      // Update NDR status
      if (result.success) {
        await prisma.nDR.update({
          where: { id: ndrId },
          data: { status: "CONTACTED" },
        });
      }

      // Log AI action
      await prisma.aIActionLog.create({
        data: {
          entityType: "NDR",
          entityId: ndrId,
          ndrId: ndrId,
          actionType: "AUTO_OUTREACH",
          actionDetails: {
            channel: "WHATSAPP",
            priority,
            automated: true,
            success: result.success,
          },
          status: result.success ? "SUCCESS" : "FAILED",
          companyId: ndr.companyId,
        },
      });
    }
  }
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/ndr/webhook",
    supportedFormats: [
      "ClickPost",
      "Delhivery",
      "BlueDart",
      "Ekart",
      "Generic",
    ],
    expectedFields: {
      required: ["awb (or equivalent)"],
      optional: ["remark", "attempt", "date", "ndr_code"],
    },
  });
}
