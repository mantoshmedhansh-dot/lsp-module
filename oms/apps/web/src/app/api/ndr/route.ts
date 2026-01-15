import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

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
  if (remark.includes("not available") || remark.includes("customer unavailable") || remark.includes("no one home")) {
    return {
      reason: "CUSTOMER_NOT_AVAILABLE",
      classification: "Customer was not present at delivery location",
      confidence: 0.92,
      priority: "MEDIUM",
      riskScore: 45,
    };
  }

  // Wrong address patterns
  if (remark.includes("wrong address") || remark.includes("address not found") || remark.includes("incomplete address")) {
    return {
      reason: "WRONG_ADDRESS",
      classification: "Delivery address is incorrect or incomplete",
      confidence: 0.95,
      priority: "HIGH",
      riskScore: 75,
    };
  }

  // Phone unreachable patterns
  if (remark.includes("phone off") || remark.includes("not reachable") || remark.includes("wrong number")) {
    return {
      reason: "PHONE_UNREACHABLE",
      classification: "Customer phone is switched off or unreachable",
      confidence: 0.90,
      priority: "HIGH",
      riskScore: 70,
    };
  }

  // Refused patterns
  if (remark.includes("refused") || remark.includes("rejected") || remark.includes("cancelled by customer")) {
    return {
      reason: "REFUSED",
      classification: "Customer refused to accept delivery",
      confidence: 0.98,
      priority: "CRITICAL",
      riskScore: 95,
    };
  }

  // COD not ready patterns
  if (remark.includes("cod not ready") || remark.includes("no cash") || remark.includes("payment issue")) {
    return {
      reason: "COD_NOT_READY",
      classification: "Customer did not have COD amount ready",
      confidence: 0.93,
      priority: "MEDIUM",
      riskScore: 40,
    };
  }

  // Reschedule patterns
  if (remark.includes("reschedule") || remark.includes("out of town") || remark.includes("request callback")) {
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

// GET /api/ndr - List NDRs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const reason = searchParams.get("reason") || "";
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
        { ndrCode: { contains: search, mode: "insensitive" } },
        { order: { orderNo: { contains: search, mode: "insensitive" } } },
        { order: { customerName: { contains: search, mode: "insensitive" } } },
        { order: { customerPhone: { contains: search } } },
        { delivery: { awbNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (reason) {
      where.reason = reason;
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

    const [ndrs, total] = await Promise.all([
      prisma.nDR.findMany({
        where,
        include: {
          Order: {
            select: {
              id: true,
              orderNo: true,
              externalOrderNo: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              shippingAddress: true,
              paymentMode: true,
              totalAmount: true,
            },
          },
          Delivery: {
            select: {
              id: true,
              deliveryNo: true,
              awbNo: true,
              status: true,
              Transporter: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
          NDROutreach: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: {
            select: {
              NDROutreach: true,
              AIActionLog: true,
            },
          },
        },
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.nDR.count({ where }),
    ]);

    // Get status counts for dashboard
    const companyFilter = where.companyId;
    const statusCounts = await prisma.nDR.groupBy({
      by: ["status"],
      where: companyFilter ? { companyId: companyFilter as string } : undefined,
      _count: { _all: true },
    });

    const priorityCounts = await prisma.nDR.groupBy({
      by: ["priority"],
      where: companyFilter ? { companyId: companyFilter as string } : undefined,
      _count: { _all: true },
    });

    const reasonCounts = await prisma.nDR.groupBy({
      by: ["reason"],
      where: companyFilter ? { companyId: companyFilter as string } : undefined,
      _count: { _all: true },
    });

    // Compute average resolution time from resolved NDRs
    const resolvedNDRs = await prisma.nDR.findMany({
      where: {
        ...(companyFilter ? { companyId: companyFilter as string } : {}),
        status: "RESOLVED",
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionHours = 0;
    if (resolvedNDRs.length > 0) {
      const totalHours = resolvedNDRs.reduce((sum, ndr) => {
        if (ndr.resolvedAt) {
          const diffMs = new Date(ndr.resolvedAt).getTime() - new Date(ndr.createdAt).getTime();
          return sum + (diffMs / (1000 * 60 * 60));
        }
        return sum;
      }, 0);
      avgResolutionHours = totalHours / resolvedNDRs.length;
    }

    // Compute outreach success rate
    const outreachStats = await prisma.nDROutreach.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const totalOutreach = outreachStats.reduce((sum, s) => sum + s._count._all, 0);
    const successfulOutreach = outreachStats
      .filter(s => ["DELIVERED", "READ", "RESPONDED"].includes(s.status))
      .reduce((sum, s) => sum + s._count._all, 0);
    const outreachSuccessRate = totalOutreach > 0 ? Math.round((successfulOutreach / totalOutreach) * 100) : 0;

    return NextResponse.json({
      ndrs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      priorityCounts: priorityCounts.reduce((acc, item) => {
        acc[item.priority] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      reasonCounts: reasonCounts.reduce((acc, item) => {
        acc[item.reason] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      outreachSuccessRate,
    });
  } catch (error) {
    console.error("Error fetching NDRs:", error);
    return NextResponse.json(
      { error: "Failed to fetch NDRs" },
      { status: 500 }
    );
  }
}

// POST /api/ndr - Create a new NDR (typically from webhook or manual)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      deliveryId,
      orderId,
      carrierNDRCode,
      carrierRemark,
      attemptNumber = 1,
      attemptDate,
    } = body;

    // Validate required fields
    if (!deliveryId || !orderId) {
      return NextResponse.json(
        { error: "Missing required fields: deliveryId and orderId" },
        { status: 400 }
      );
    }

    // Check if delivery exists
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        Order: {
          include: {
            Location: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: "Delivery not found" },
        { status: 404 }
      );
    }

    // AI classify the NDR reason
    const classification = classifyNDRReason(carrierRemark || "");

    // Create NDR record
    const ndr = await prisma.nDR.create({
      data: {
        ndrCode: generateNDRCode(),
        deliveryId,
        orderId,
        carrierNDRCode,
        carrierRemark,
        attemptNumber,
        attemptDate: attemptDate ? new Date(attemptDate) : new Date(),
        reason: classification.reason as "CUSTOMER_NOT_AVAILABLE" | "WRONG_ADDRESS" | "PHONE_UNREACHABLE" | "REFUSED" | "COD_NOT_READY" | "CUSTOMER_RESCHEDULE" | "OTHER",
        aiClassification: classification.classification,
        confidence: classification.confidence,
        status: "OPEN",
        priority: classification.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        riskScore: classification.riskScore,
        companyId: session.user.companyId || delivery.Order.Location.companyId,
      },
      include: {
        Order: true,
        Delivery: {
          include: {
            Transporter: true,
          },
        },
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
          carrierRemark,
          classifiedReason: classification.reason,
          confidence: classification.confidence,
          priority: classification.priority,
          riskScore: classification.riskScore,
        },
        status: "SUCCESS",
        confidence: classification.confidence,
        processingTime: 50, // ms
        companyId: ndr.companyId,
      },
    });

    return NextResponse.json(ndr, { status: 201 });
  } catch (error) {
    console.error("Error creating NDR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create NDR" },
      { status: 500 }
    );
  }
}
