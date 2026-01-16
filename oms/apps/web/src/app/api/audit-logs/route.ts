import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/audit-logs - List audit logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow SUPER_ADMIN and ADMIN to view audit logs
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Filters
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const search = searchParams.get("search");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }

    if (userId) {
      where.userId = userId;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
      }
      if (toDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(toDate);
      }
    }

    if (search) {
      where.OR = [
        { entityType: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count and logs
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

// POST /api/audit-logs - Get audit log summary/statistics
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow SUPER_ADMIN and ADMIN to view audit logs
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action = "summary" } = body;

    if (action === "summary") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get summary statistics
      const [
        totalLogs,
        recentLogs,
        actionBreakdown,
        entityBreakdown,
        userActivity,
      ] = await Promise.all([
        // Total count
        prisma.auditLog.count(),

        // Recent logs count (last 30 days)
        prisma.auditLog.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),

        // Breakdown by action
        prisma.auditLog.groupBy({
          by: ["action"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: { _all: true },
          orderBy: { _count: { action: "desc" } },
          take: 10,
        }),

        // Breakdown by entity type
        prisma.auditLog.groupBy({
          by: ["entityType"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: { _all: true },
          orderBy: { _count: { entityType: "desc" } },
          take: 10,
        }),

        // Most active users
        prisma.auditLog.groupBy({
          by: ["userId"],
          where: {
            createdAt: { gte: thirtyDaysAgo },
            userId: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { userId: "desc" } },
          take: 10,
        }),
      ]);

      // Get user details for active users
      const userIds = userActivity
        .map((u) => u.userId)
        .filter((id): id is string => id !== null);

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return NextResponse.json({
        summary: {
          totalLogs,
          recentLogs,
          actionBreakdown: actionBreakdown.map((a) => ({
            action: a.action,
            count: a._count._all,
          })),
          entityBreakdown: entityBreakdown.map((e) => ({
            entityType: e.entityType,
            count: e._count._all,
          })),
          userActivity: userActivity.map((u) => ({
            userId: u.userId,
            userName: u.userId ? userMap.get(u.userId)?.name : null,
            userEmail: u.userId ? userMap.get(u.userId)?.email : null,
            count: u._count._all,
          })),
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error getting audit log summary:", error);
    return NextResponse.json(
      { error: "Failed to get audit log summary" },
      { status: 500 }
    );
  }
}
