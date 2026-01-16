import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/qc/templates/[id]/parameters - Add a new parameter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: templateId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const template = await prisma.qCTemplate.findUnique({ where: { id: templateId } });

    if (!template) {
      return NextResponse.json({ error: "QC template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, type, description, isMandatory, expectedValue, tolerance, order } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // Get the next sequence number if not provided
    const existingParams = await prisma.qCParameter.count({
      where: { templateId },
    });
    const sequence = order ?? existingParams + 1;

    // Generate code if not provided
    const paramCode = `PARAM_${Date.now().toString(36).toUpperCase()}`;

    const parameter = await prisma.qCParameter.create({
      data: {
        templateId,
        code: paramCode,
        name,
        type,
        description,
        isMandatory: isMandatory ?? true,
        acceptableValues: expectedValue ? [expectedValue] : [],
        sequence,
        // Map frontend fields to schema fields
        tolerance: tolerance ? parseFloat(tolerance) : null,
        requiresPhoto: false,
      },
    });

    // Return in frontend expected format
    return NextResponse.json({
      id: parameter.id,
      name: parameter.name,
      type: parameter.type,
      description: parameter.description || "",
      isMandatory: parameter.isMandatory,
      expectedValue: parameter.acceptableValues?.[0] || "",
      tolerance: parameter.tolerance?.toString() || "",
      order: parameter.sequence,
    });
  } catch (error) {
    console.error("Error adding QC parameter:", error);
    return NextResponse.json(
      { error: "Failed to add QC parameter" },
      { status: 500 }
    );
  }
}
