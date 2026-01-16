import { NextRequest, NextResponse } from "next/server";
import { prisma, GatePassStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/gate-passes/[id] - Get gate pass details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const gatePass = await prisma.gatePass.findUnique({
      where: { id },
      include: {
        GatePassItem: true,
      },
    });

    if (!gatePass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    return NextResponse.json(gatePass);
  } catch (error) {
    console.error("Error fetching gate pass:", error);
    return NextResponse.json(
      { error: "Failed to fetch gate pass" },
      { status: 500 }
    );
  }
}

// PATCH /api/gate-passes/[id] - Update gate pass
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...updateData } = body;

    const gatePass = await prisma.gatePass.findUnique({
      where: { id },
      include: { GatePassItem: true },
    });

    if (!gatePass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    // Handle specific actions
    // GatePassStatus: OPEN, IN_PROGRESS, CLOSED, VERIFIED, CANCELLED
    switch (action) {
      case "start": {
        if (gatePass.status !== "OPEN") {
          return NextResponse.json(
            { error: "Gate pass must be OPEN to start" },
            { status: 400 }
          );
        }

        const updated = await prisma.gatePass.update({
          where: { id },
          data: {
            status: "IN_PROGRESS" as GatePassStatus,
          },
        });

        return NextResponse.json(updated);
      }

      case "close": {
        if (gatePass.status !== "IN_PROGRESS") {
          return NextResponse.json(
            { error: "Gate pass must be IN_PROGRESS to close" },
            { status: 400 }
          );
        }

        const updated = await prisma.gatePass.update({
          where: { id },
          data: {
            status: "CLOSED" as GatePassStatus,
            exitTime: new Date(),
          },
        });

        return NextResponse.json(updated);
      }

      case "verify": {
        if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (gatePass.status !== "CLOSED") {
          return NextResponse.json(
            { error: "Gate pass must be CLOSED to verify" },
            { status: 400 }
          );
        }

        const updated = await prisma.gatePass.update({
          where: { id },
          data: {
            status: "VERIFIED" as GatePassStatus,
            verifiedById: session.user.id,
            verifiedAt: new Date(),
          },
        });

        return NextResponse.json(updated);
      }

      case "cancel": {
        if (["VERIFIED", "CLOSED"].includes(gatePass.status)) {
          return NextResponse.json(
            { error: "Cannot cancel closed or verified gate pass" },
            { status: 400 }
          );
        }

        const updated = await prisma.gatePass.update({
          where: { id },
          data: {
            status: "CANCELLED" as GatePassStatus,
            securityRemarks: updateData.remarks || "Cancelled",
          },
        });

        return NextResponse.json(updated);
      }

      case "update_items": {
        const { items } = updateData;

        if (!items || !Array.isArray(items)) {
          return NextResponse.json(
            { error: "Items array is required" },
            { status: 400 }
          );
        }

        // Delete existing items
        await prisma.gatePassItem.deleteMany({
          where: { gatePassId: id },
        });

        // Create new items
        await prisma.gatePassItem.createMany({
          data: items.map((item: {
            skuId?: string;
            description?: string;
            quantity: number;
            unit?: string;
            remarks?: string;
          }) => ({
            gatePassId: id,
            skuId: item.skuId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            remarks: item.remarks,
          })),
        });

        const updated = await prisma.gatePass.findUnique({
          where: { id },
          include: { GatePassItem: true },
        });

        return NextResponse.json(updated);
      }

      default: {
        // Simple field updates
        const allowedFields = [
          "visitorName",
          "visitorPhone",
          "visitorIdType",
          "visitorIdNo",
          "companyName",
          "purpose",
          "vehicleNumber",
          "vehicleType",
          "driverName",
          "driverPhone",
          "sealNumber",
          "awbNo",
          "poNo",
          "invoiceNo",
          "remarks",
        ];

        const filteredData: Record<string, unknown> = {};
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            filteredData[field] = updateData[field];
          }
        }

        if (Object.keys(filteredData).length === 0) {
          return NextResponse.json(
            { error: "No valid fields to update" },
            { status: 400 }
          );
        }

        const updated = await prisma.gatePass.update({
          where: { id },
          data: filteredData,
          include: {
            GatePassItem: true,
          },
        });

        return NextResponse.json(updated);
      }
    }
  } catch (error) {
    console.error("Error updating gate pass:", error);
    return NextResponse.json(
      { error: "Failed to update gate pass" },
      { status: 500 }
    );
  }
}

// DELETE /api/gate-passes/[id] - Delete gate pass
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const gatePass = await prisma.gatePass.findUnique({
      where: { id },
    });

    if (!gatePass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    if (["IN_PROGRESS", "VERIFIED"].includes(gatePass.status)) {
      return NextResponse.json(
        { error: "Cannot delete active or verified gate pass" },
        { status: 400 }
      );
    }

    // Delete items first
    await prisma.gatePassItem.deleteMany({
      where: { gatePassId: id },
    });

    // Delete gate pass
    await prisma.gatePass.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Gate pass deleted" });
  } catch (error) {
    console.error("Error deleting gate pass:", error);
    return NextResponse.json(
      { error: "Failed to delete gate pass" },
      { status: 500 }
    );
  }
}
