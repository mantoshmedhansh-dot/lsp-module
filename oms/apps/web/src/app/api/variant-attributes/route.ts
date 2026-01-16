import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/variant-attributes - List variant attributes
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const companyId = searchParams.get("companyId");

    const where: Record<string, unknown> = { isActive: true };
    if (type) where.type = type;
    if (companyId) where.companyId = companyId;

    const attributes = await prisma.variantAttribute.findMany({
      where,
      include: {
        VariantAttributeValue: {
          orderBy: { sortOrder: "asc" },
        },
        _count: {
          select: { VariantAttributeValue: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ data: attributes });
  } catch (error) {
    console.error("Error fetching variant attributes:", error);
    return NextResponse.json(
      { error: "Failed to fetch variant attributes" },
      { status: 500 }
    );
  }
}

// POST /api/variant-attributes - Create variant attribute
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { companyId, code, name, type, values, displayOrder } = body;

    if (!companyId || !code || !name || !type) {
      return NextResponse.json(
        { error: "companyId, code, name, and type are required" },
        { status: 400 }
      );
    }

    // Check if attribute already exists
    const existing = await prisma.variantAttribute.findFirst({
      where: { companyId, code },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Attribute with this code already exists" },
        { status: 400 }
      );
    }

    // Create attribute with values in transaction
    const attribute = await prisma.$transaction(async (tx) => {
      const newAttribute = await tx.variantAttribute.create({
        data: {
          companyId,
          code: code.toUpperCase(),
          name,
          type,
          displayOrder: displayOrder || 0,
        },
      });

      // Create values if provided
      if (values && values.length > 0) {
        await tx.variantAttributeValue.createMany({
          data: values.map((v: { value: string; displayName?: string; hexCode?: string; sizeOrder?: number }, i: number) => ({
            attributeId: newAttribute.id,
            value: v.value,
            displayName: v.displayName,
            hexCode: v.hexCode,
            sizeOrder: v.sizeOrder,
            sortOrder: i,
          })),
        });
      }

      return newAttribute;
    });

    // Fetch complete attribute
    const completeAttribute = await prisma.variantAttribute.findUnique({
      where: { id: attribute.id },
      include: {
        VariantAttributeValue: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json(completeAttribute, { status: 201 });
  } catch (error) {
    console.error("Error creating variant attribute:", error);
    return NextResponse.json(
      { error: "Failed to create variant attribute" },
      { status: 500 }
    );
  }
}
