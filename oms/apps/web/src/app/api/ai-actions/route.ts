import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

// GET /api/ai-actions - List AI actions with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || "";
    const entityId = searchParams.get("entityId") || "";
    const actionType = searchParams.get("actionType") || "";
    const status = searchParams.get("status") || "";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Add company filter
    if (session.user.companyId) {
      where.companyId = session.user.companyId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (status) {
      where.status = status;
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

    const [actionsRaw, total] = await Promise.all([
      prisma.aIActionLog.findMany({
        where,
        include: {
          NDR: {
            select: {
              id: true,
              ndrCode: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aIActionLog.count({ where }),
    ]);

    // Transform to match frontend interface (lowercase property names)
    const actions = actionsRaw.map((action) => ({
      ...action,
      ndr: action.NDR,
      errorMessage: action.executionError,
      NDR: undefined,
      executionError: undefined,
    }));

    // Get aggregated stats
    const companyFilter = where.companyId;
    const stats = await getAIActionStats(companyFilter as string);

    return NextResponse.json({
      actions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error) {
    console.error("Error fetching AI actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI actions" },
      { status: 500 }
    );
  }
}

// Helper to get AI action statistics
async function getAIActionStats(companyId?: string) {
  const baseWhere = companyId ? { companyId } : {};

  // Get action type distribution
  const actionTypeCounts = await prisma.aIActionLog.groupBy({
    by: ["actionType"],
    where: baseWhere,
    _count: { _all: true },
  });

  // Get status distribution
  const statusCounts = await prisma.aIActionLog.groupBy({
    by: ["status"],
    where: baseWhere,
    _count: { _all: true },
  });

  // Get average confidence for successful actions
  const avgConfidence = await prisma.aIActionLog.aggregate({
    where: {
      ...baseWhere,
      status: "SUCCESS",
      confidence: { not: null },
    },
    _avg: { confidence: true },
  });

  // Get average processing time
  const avgProcessingTime = await prisma.aIActionLog.aggregate({
    where: {
      ...baseWhere,
      processingTime: { not: null },
    },
    _avg: { processingTime: true },
  });

  // Get today's action counts
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayActions = await prisma.aIActionLog.count({
    where: {
      ...baseWhere,
      createdAt: { gte: today },
    },
  });

  const todaySuccessful = await prisma.aIActionLog.count({
    where: {
      ...baseWhere,
      createdAt: { gte: today },
      status: "SUCCESS",
    },
  });

  // Get entity type distribution
  const entityTypeCounts = await prisma.aIActionLog.groupBy({
    by: ["entityType"],
    where: baseWhere,
    _count: { _all: true },
  });

  return {
    actionTypes: actionTypeCounts.reduce((acc, item) => {
      acc[item.actionType] = item._count._all;
      return acc;
    }, {} as Record<string, number>),
    statuses: statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {} as Record<string, number>),
    entityTypes: entityTypeCounts.reduce((acc, item) => {
      acc[item.entityType] = item._count._all;
      return acc;
    }, {} as Record<string, number>),
    averageConfidence: avgConfidence._avg.confidence || 0,
    averageProcessingTime: avgProcessingTime._avg.processingTime || 0,
    todayStats: {
      total: todayActions,
      successful: todaySuccessful,
      successRate: todayActions > 0 ? (todaySuccessful / todayActions) * 100 : 0,
    },
  };
}

// POST /api/ai-actions - Create an AI action log entry
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      entityType,
      entityId,
      ndrId,
      actionType,
      actionDetails,
      status,
      confidence,
      processingTime,
      errorMessage,
    } = body;

    // Validate required fields
    if (!entityType || !entityId || !actionType || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const action = await prisma.aIActionLog.create({
      data: {
        entityType,
        entityId,
        ndrId,
        actionType: actionType as "AUTO_CLASSIFY" | "AUTO_OUTREACH" | "AUTO_RESOLVE" | "SENTIMENT_ANALYSIS" | "PRIORITY_UPDATE" | "ESCALATION" | "PREDICTION" | "MANUAL_UPDATE" | "OUTREACH_ATTEMPT" | "PROACTIVE_TRIGGER",
        actionDetails,
        status: status as "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED",
        confidence,
        processingTime,
        executionError: errorMessage,
        companyId: session.user.companyId || "",
      },
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error("Error creating AI action log:", error);
    return NextResponse.json(
      { error: "Failed to create AI action log" },
      { status: 500 }
    );
  }
}
