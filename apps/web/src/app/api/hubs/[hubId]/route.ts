import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { updateHubSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ hubId: string }>;
}

// GET /api/hubs/[hubId] - Get hub details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { hubId } = await params;

    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
      include: {
        staff: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        servicedPincodes: {
          orderBy: { pincode: "asc" },
        },
        _count: {
          select: {
            staff: true,
            servicedPincodes: true,
          },
        },
      },
    });

    if (!hub) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Hub not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: hub });
  } catch (error) {
    console.error("Error fetching hub:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch hub" } },
      { status: 500 }
    );
  }
}

// PATCH /api/hubs/[hubId] - Update hub
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { hubId } = await params;
    const body = await request.json();
    const validated = updateHubSchema.safeParse(body);

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
    const existingHub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!existingHub) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Hub not found" } },
        { status: 404 }
      );
    }

    // If code is being changed, check for duplicates
    if (validated.data.code && validated.data.code.toUpperCase() !== existingHub.code) {
      const duplicateHub = await prisma.hub.findUnique({
        where: { code: validated.data.code.toUpperCase() },
      });

      if (duplicateHub) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_CODE",
              message: `Hub with code ${validated.data.code} already exists`,
            },
          },
          { status: 400 }
        );
      }
    }

    const data = validated.data;

    const hub = await prisma.hub.update({
      where: { id: hubId },
      data: {
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.address && { address: data.address }),
        ...(data.pincode && { pincode: data.pincode }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.totalBays !== undefined && { totalBays: data.totalBays }),
        ...(data.loadingBays !== undefined && { loadingBays: data.loadingBays }),
        ...(data.unloadingBays !== undefined && { unloadingBays: data.unloadingBays }),
        ...(data.sortingCapacity !== undefined && { sortingCapacity: data.sortingCapacity }),
        ...(data.operatingHoursStart && { operatingHoursStart: data.operatingHoursStart }),
        ...(data.operatingHoursEnd && { operatingHoursEnd: data.operatingHoursEnd }),
        ...(data.contactName && { contactName: data.contactName }),
        ...(data.contactPhone && { contactPhone: data.contactPhone }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
      },
    });

    return NextResponse.json({ success: true, data: hub });
  } catch (error) {
    console.error("Error updating hub:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_ERROR", message: "Failed to update hub" } },
      { status: 500 }
    );
  }
}

// DELETE /api/hubs/[hubId] - Soft delete hub
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { hubId } = await params;

    // Check if hub exists
    const existingHub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!existingHub) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Hub not found" } },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.hub.update({
      where: { id: hubId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Hub deactivated successfully" },
    });
  } catch (error) {
    console.error("Error deleting hub:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_ERROR", message: "Failed to delete hub" } },
      { status: 500 }
    );
  }
}
