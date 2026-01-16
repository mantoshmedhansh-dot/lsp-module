import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// PATCH /api/qc/templates/[id]/parameters/[parameterId] - Update a parameter
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; parameterId: string }> }
) {
  try {
    const session = await auth();
    const { id: templateId, parameterId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parameter = await prisma.qCParameter.findUnique({
      where: { id: parameterId },
    });

    if (!parameter || parameter.templateId !== templateId) {
      return NextResponse.json({ error: "Parameter not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, type, description, isMandatory, expectedValue, tolerance, order } = body;

    const updated = await prisma.qCParameter.update({
      where: { id: parameterId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(isMandatory !== undefined && { isMandatory }),
        ...(expectedValue !== undefined && { acceptableValues: expectedValue ? [expectedValue] : [] }),
        ...(tolerance !== undefined && { tolerance: tolerance ? parseFloat(tolerance) : null }),
        ...(order !== undefined && { sequence: order }),
      },
    });

    // Return in frontend expected format
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      description: updated.description || "",
      isMandatory: updated.isMandatory,
      expectedValue: updated.acceptableValues?.[0] || "",
      tolerance: updated.tolerance?.toString() || "",
      order: updated.sequence,
    });
  } catch (error) {
    console.error("Error updating QC parameter:", error);
    return NextResponse.json(
      { error: "Failed to update QC parameter" },
      { status: 500 }
    );
  }
}

// DELETE /api/qc/templates/[id]/parameters/[parameterId] - Delete a parameter
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; parameterId: string }> }
) {
  try {
    const session = await auth();
    const { id: templateId, parameterId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parameter = await prisma.qCParameter.findUnique({
      where: { id: parameterId },
    });

    if (!parameter || parameter.templateId !== templateId) {
      return NextResponse.json({ error: "Parameter not found" }, { status: 404 });
    }

    await prisma.qCParameter.delete({
      where: { id: parameterId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting QC parameter:", error);
    return NextResponse.json(
      { error: "Failed to delete QC parameter" },
      { status: 500 }
    );
  }
}
