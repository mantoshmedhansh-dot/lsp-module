import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/qc/templates/[id] - Get QC template details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const template = await prisma.qCTemplate.findUnique({
      where: { id },
      include: {
        QCParameter: {
          orderBy: { sequence: "asc" },
        },
        _count: {
          select: { QCExecution: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "QC template not found" }, { status: 404 });
    }

    // Transform to match frontend expected format
    return NextResponse.json({
      ...template,
      qcType: template.type,
    });
  } catch (error) {
    console.error("Error fetching QC template:", error);
    return NextResponse.json(
      { error: "Failed to fetch QC template" },
      { status: 500 }
    );
  }
}

// PATCH /api/qc/templates/[id] - Update QC template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const template = await prisma.qCTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json({ error: "QC template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, type, isActive, parameters } = body;

    // Update template and parameters in transaction
    const updatedTemplate = await prisma.$transaction(async (tx) => {
      // Update template
      const updated = await tx.qCTemplate.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // If parameters provided, replace them
      if (parameters) {
        // Delete existing parameters
        await tx.qCParameter.deleteMany({ where: { templateId: id } });

        // Create new parameters
        for (let i = 0; i < parameters.length; i++) {
          const param = parameters[i];
          await tx.qCParameter.create({
            data: {
              templateId: id,
              code: param.code || `PARAM_${i + 1}`,
              name: param.name,
              type: param.type,
              isMandatory: param.isMandatory ?? true,
              acceptableValues: param.acceptableValues || [],
              minValue: param.minValue,
              maxValue: param.maxValue,
              tolerance: param.tolerance,
              requiresPhoto: param.requiresPhoto ?? false,
              sequence: param.sequence ?? i + 1,
            },
          });
        }
      }

      return updated;
    });

    // Fetch complete template
    const completeTemplate = await prisma.qCTemplate.findUnique({
      where: { id },
      include: {
        QCParameter: {
          orderBy: { sequence: "asc" },
        },
        _count: {
          select: { QCExecution: true, QCParameter: true },
        },
      },
    });

    // Transform to match frontend expected format
    return NextResponse.json({
      ...completeTemplate,
      qcType: completeTemplate?.type,
    });
  } catch (error) {
    console.error("Error updating QC template:", error);
    return NextResponse.json(
      { error: "Failed to update QC template" },
      { status: 500 }
    );
  }
}

// DELETE /api/qc/templates/[id] - Delete QC template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const template = await prisma.qCTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json({ error: "QC template not found" }, { status: 404 });
    }

    // Check if template has executions
    const executionCount = await prisma.qCExecution.count({
      where: { templateId: id },
    });

    if (executionCount > 0) {
      // Soft delete by deactivating
      await prisma.qCTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Template deactivated (has existing executions)",
      });
    }

    // Hard delete if no executions
    await prisma.$transaction(async (tx) => {
      await tx.qCParameter.deleteMany({ where: { templateId: id } });
      await tx.qCTemplate.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting QC template:", error);
    return NextResponse.json(
      { error: "Failed to delete QC template" },
      { status: 500 }
    );
  }
}
