import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { updateVehicleSchema, vehicleMaintenanceSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ vehicleId: string }>;
}

// GET /api/vehicles/[vehicleId] - Get vehicle details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { vehicleId } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        maintenanceLogs: {
          orderBy: { startDate: "desc" },
          take: 10,
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Vehicle not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch vehicle" } },
      { status: 500 }
    );
  }
}

// PATCH /api/vehicles/[vehicleId] - Update vehicle
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { vehicleId } = await params;
    const body = await request.json();
    const validated = updateVehicleSchema.safeParse(body);

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

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Vehicle not found" } },
        { status: 404 }
      );
    }

    const data = validated.data;

    // If registration is being changed, check for duplicates
    if (data.registrationNo && data.registrationNo.toUpperCase() !== existingVehicle.registrationNo) {
      const duplicateVehicle = await prisma.vehicle.findUnique({
        where: { registrationNo: data.registrationNo.toUpperCase() },
      });

      if (duplicateVehicle) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_REGISTRATION",
              message: `Vehicle with registration ${data.registrationNo} already exists`,
            },
          },
          { status: 400 }
        );
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(data.registrationNo && { registrationNo: data.registrationNo.toUpperCase() }),
        ...(data.type && { type: data.type }),
        ...(data.capacityTonnage !== undefined && { capacityTonnage: data.capacityTonnage }),
        ...(data.capacityVolumeCBM !== undefined && { capacityVolumeCBM: data.capacityVolumeCBM }),
        ...(data.lengthFt !== undefined && { lengthFt: data.lengthFt }),
        ...(data.widthFt !== undefined && { widthFt: data.widthFt }),
        ...(data.heightFt !== undefined && { heightFt: data.heightFt }),
        ...(data.make !== undefined && { make: data.make }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.fuelType && { fuelType: data.fuelType }),
        ...(data.rcExpiryDate !== undefined && { rcExpiryDate: data.rcExpiryDate }),
        ...(data.insuranceExpiry !== undefined && { insuranceExpiry: data.insuranceExpiry }),
        ...(data.fitnessExpiry !== undefined && { fitnessExpiry: data.fitnessExpiry }),
        ...(data.permitExpiry !== undefined && { permitExpiry: data.permitExpiry }),
        ...(data.pollutionExpiry !== undefined && { pollutionExpiry: data.pollutionExpiry }),
        ...(data.currentHubId !== undefined && { currentHubId: data.currentHubId }),
        ...(data.ownershipType && { ownershipType: data.ownershipType }),
        ...(data.ownerName !== undefined && { ownerName: data.ownerName }),
        ...(data.ownerPhone !== undefined && { ownerPhone: data.ownerPhone }),
        ...(data.gpsDeviceId !== undefined && { gpsDeviceId: data.gpsDeviceId }),
      },
    });

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_ERROR", message: "Failed to update vehicle" } },
      { status: 500 }
    );
  }
}

// DELETE /api/vehicles/[vehicleId] - Retire vehicle (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { vehicleId } = await params;

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Vehicle not found" } },
        { status: 404 }
      );
    }

    // Soft delete by setting status to RETIRED and isActive to false
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        isActive: false,
        status: "RETIRED",
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Vehicle retired successfully" },
    });
  } catch (error) {
    console.error("Error retiring vehicle:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_ERROR", message: "Failed to retire vehicle" } },
      { status: 500 }
    );
  }
}
