import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/qc/templates/[id]/duplicate - Duplicate a QC template
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

    // Get the original template with parameters
    const original = await prisma.qCTemplate.findUnique({
      where: { id: templateId },
      include: {
        QCParameter: true,
      },
    });

    if (!original) {
      return NextResponse.json({ error: "QC template not found" }, { status: 404 });
    }

    // Create the duplicate in a transaction
    const duplicated = await prisma.$transaction(async (tx) => {
      // Generate a unique code for the duplicate template
      const timestamp = Date.now().toString(36).toUpperCase();
      const duplicateCode = `${original.code}_COPY_${timestamp}`;

      // Create new template
      const newTemplate = await tx.qCTemplate.create({
        data: {
          code: duplicateCode,
          companyId: original.companyId,
          name: `${original.name} (Copy)`,
          description: original.description,
          type: original.type,
          isActive: true,
        },
      });

      // Copy parameters
      if (original.QCParameter.length > 0) {
        await tx.qCParameter.createMany({
          data: original.QCParameter.map((param) => ({
            templateId: newTemplate.id,
            code: param.code,
            name: param.name,
            type: param.type,
            isMandatory: param.isMandatory,
            acceptableValues: param.acceptableValues,
            minValue: param.minValue,
            maxValue: param.maxValue,
            tolerance: param.tolerance,
            requiresPhoto: param.requiresPhoto,
            sequence: param.sequence,
          })),
        });
      }

      return newTemplate;
    });

    // Fetch complete template with parameters
    const completeTemplate = await prisma.qCTemplate.findUnique({
      where: { id: duplicated.id },
      include: {
        QCParameter: {
          orderBy: { sequence: "asc" },
        },
        _count: {
          select: { QCExecution: true },
        },
      },
    });

    return NextResponse.json(completeTemplate);
  } catch (error) {
    console.error("Error duplicating QC template:", error);
    return NextResponse.json(
      { error: "Failed to duplicate QC template" },
      { status: 500 }
    );
  }
}
