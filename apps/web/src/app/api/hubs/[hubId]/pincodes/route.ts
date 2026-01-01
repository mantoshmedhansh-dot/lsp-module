import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { hubPincodeMappingSchema } from "@/lib/validations";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ hubId: string }>;
}

// GET /api/hubs/[hubId]/pincodes - List pincode mappings
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { hubId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Check if hub exists
    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!hub) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Hub not found" } },
        { status: 404 }
      );
    }

    const where: any = { hubId };
    if (type) {
      where.type = type;
    }

    const pincodes = await prisma.hubPincodeMapping.findMany({
      where,
      orderBy: { pincode: "asc" },
    });

    return NextResponse.json({ success: true, data: pincodes });
  } catch (error) {
    console.error("Error fetching pincodes:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch pincodes" } },
      { status: 500 }
    );
  }
}

// POST /api/hubs/[hubId]/pincodes - Add pincode mapping
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { hubId } = await params;
    const body = await request.json();
    const validated = hubPincodeMappingSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0].message,
            details: validated.error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Check if hub exists
    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!hub) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Hub not found" } },
        { status: 404 }
      );
    }

    const data = validated.data;

    // Check if mapping already exists
    const existingMapping = await prisma.hubPincodeMapping.findUnique({
      where: {
        hubId_pincode_type: {
          hubId,
          pincode: data.pincode,
          type: data.type,
        },
      },
    });

    if (existingMapping) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_MAPPING",
            message: `Pincode ${data.pincode} already mapped for ${data.type}`,
          },
        },
        { status: 400 }
      );
    }

    const mapping = await prisma.hubPincodeMapping.create({
      data: {
        hubId,
        pincode: data.pincode,
        type: data.type,
        priority: data.priority,
      },
    });

    return NextResponse.json({ success: true, data: mapping }, { status: 201 });
  } catch (error) {
    console.error("Error creating pincode mapping:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_ERROR", message: "Failed to create pincode mapping" } },
      { status: 500 }
    );
  }
}

// DELETE /api/hubs/[hubId]/pincodes - Remove pincode mapping (bulk or single)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { hubId } = await params;
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get("pincode");
    const type = searchParams.get("type");
    const mappingId = searchParams.get("id");

    // Check if hub exists
    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!hub) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Hub not found" } },
        { status: 404 }
      );
    }

    // Delete by ID
    if (mappingId) {
      await prisma.hubPincodeMapping.delete({
        where: { id: mappingId, hubId },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Pincode mapping removed" },
      });
    }

    // Delete by pincode and type
    if (pincode && type) {
      await prisma.hubPincodeMapping.deleteMany({
        where: {
          hubId,
          pincode,
          type,
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Pincode mapping removed" },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MISSING_PARAMS",
          message: "Provide either 'id' or both 'pincode' and 'type' parameters",
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error deleting pincode mapping:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_ERROR", message: "Failed to delete pincode mapping" } },
      { status: 500 }
    );
  }
}
