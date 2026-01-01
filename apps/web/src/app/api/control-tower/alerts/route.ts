import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const severity = searchParams.get("severity");
    const status = searchParams.get("status") || "ACTIVE";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = { in: severity.split(",") };
    }

    // Check for expiry
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ];

    // Fetch alerts
    const [alerts, totalCount] = await Promise.all([
      prisma.controlTowerAlert.findMany({
        where,
        orderBy: [
          { severity: "desc" }, // CRITICAL first
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.controlTowerAlert.count({ where }),
    ]);

    // Get severity counts
    const severityCounts = await prisma.controlTowerAlert.groupBy({
      by: ["severity"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    });

    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    severityCounts.forEach((sc) => {
      const key = sc.severity.toLowerCase() as keyof typeof counts;
      if (key in counts) {
        counts[key] = sc._count.id;
      }
    });

    // Format response
    const items = alerts.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      shipmentId: alert.shipmentId,
      tripId: alert.tripId,
      hubId: alert.hubId,
      metrics: alert.metrics ? JSON.parse(alert.metrics as string) : null,
      status: alert.status,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
      createdAt: alert.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        counts,
        pagination: {
          total: totalCount,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error("Control Tower Alerts Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

// POST - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      alertType,
      severity = "MEDIUM",
      title,
      description,
      shipmentId,
      tripId,
      hubId,
      metrics,
      expiresAt,
    } = body;

    // Validate required fields
    if (!alertType || !title || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: alertType, title, description" },
        { status: 400 }
      );
    }

    // Create alert
    const alert = await prisma.controlTowerAlert.create({
      data: {
        alertType,
        severity,
        title,
        description,
        shipmentId,
        tripId,
        hubId,
        metrics: metrics ? JSON.stringify(metrics) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        createdAt: alert.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Control Tower Create Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create alert" },
      { status: 500 }
    );
  }
}
