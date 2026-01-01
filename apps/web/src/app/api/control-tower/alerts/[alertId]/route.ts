import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// GET single alert
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const { alertId } = await params;

    const alert = await prisma.controlTowerAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
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
        resolvedAt: alert.resolvedAt?.toISOString() || null,
        createdAt: alert.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Control Tower Get Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch alert" },
      { status: 500 }
    );
  }
}

// PATCH - Update alert (acknowledge, resolve)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const { alertId } = await params;
    const body = await request.json();

    const { action, acknowledgedBy } = body;

    // Find existing alert
    const existingAlert = await prisma.controlTowerAlert.findUnique({
      where: { id: alertId },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case "acknowledge":
        if (existingAlert.status === "ACKNOWLEDGED" || existingAlert.status === "RESOLVED") {
          return NextResponse.json(
            { success: false, error: "Alert already acknowledged or resolved" },
            { status: 400 }
          );
        }
        updateData = {
          status: "ACKNOWLEDGED",
          acknowledgedBy: acknowledgedBy || "System",
          acknowledgedAt: new Date(),
        };
        break;

      case "resolve":
        updateData = {
          status: "RESOLVED",
          resolvedAt: new Date(),
        };
        break;

      case "reopen":
        if (existingAlert.status !== "RESOLVED") {
          return NextResponse.json(
            { success: false, error: "Can only reopen resolved alerts" },
            { status: 400 }
          );
        }
        updateData = {
          status: "ACTIVE",
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null,
        };
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action. Use: acknowledge, resolve, reopen" },
          { status: 400 }
        );
    }

    const alert = await prisma.controlTowerAlert.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: alert.id,
        status: alert.status,
        acknowledgedBy: alert.acknowledgedBy,
        acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
        resolvedAt: alert.resolvedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Control Tower Update Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update alert" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const { alertId } = await params;

    await prisma.controlTowerAlert.delete({
      where: { id: alertId },
    });

    return NextResponse.json({
      success: true,
      message: "Alert deleted successfully",
    });
  } catch (error) {
    console.error("Control Tower Delete Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete alert" },
      { status: 500 }
    );
  }
}
