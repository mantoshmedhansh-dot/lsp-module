import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { updateDriverSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ driverId: string }>;
}

// GET /api/drivers/[driverId] - Get driver details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { driverId } = await params;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        leaves: {
          orderBy: { startDate: "desc" },
          take: 10,
        },
      },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: driver });
  } catch (error) {
    console.error("Error fetching driver:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch driver" } },
      { status: 500 }
    );
  }
}

// PATCH /api/drivers/[driverId] - Update driver
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { driverId } = await params;
    const body = await request.json();
    const validated = updateDriverSchema.safeParse(body);

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

    // Check if driver exists
    const existingDriver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!existingDriver) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    const data = validated.data;

    // Check for duplicate employee code if changing
    if (data.employeeCode && data.employeeCode !== existingDriver.employeeCode) {
      const duplicateCode = await prisma.driver.findUnique({
        where: { employeeCode: data.employeeCode },
      });

      if (duplicateCode) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_CODE",
              message: `Driver with employee code ${data.employeeCode} already exists`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Check for duplicate license number if changing
    if (data.licenseNumber && data.licenseNumber !== existingDriver.licenseNumber) {
      const duplicateLicense = await prisma.driver.findUnique({
        where: { licenseNumber: data.licenseNumber },
      });

      if (duplicateLicense) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_LICENSE",
              message: `Driver with license number ${data.licenseNumber} already exists`,
            },
          },
          { status: 400 }
        );
      }
    }

    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        ...(data.employeeCode && { employeeCode: data.employeeCode }),
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
        ...(data.altPhone !== undefined && { altPhone: data.altPhone || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.pincode !== undefined && { pincode: data.pincode || null }),
        ...(data.licenseNumber && { licenseNumber: data.licenseNumber }),
        ...(data.licenseType && { licenseType: data.licenseType }),
        ...(data.licenseExpiry && { licenseExpiry: data.licenseExpiry }),
        ...(data.licenseState !== undefined && { licenseState: data.licenseState }),
        ...(data.aadharNumber !== undefined && { aadharNumber: data.aadharNumber || null }),
        ...(data.panNumber !== undefined && { panNumber: data.panNumber || null }),
        ...(data.currentHubId !== undefined && { currentHubId: data.currentHubId }),
        ...(data.joiningDate && { joiningDate: data.joiningDate }),
        ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience }),
        ...(data.emergencyContactName !== undefined && { emergencyContactName: data.emergencyContactName }),
        ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: data.emergencyContactPhone || null }),
      },
    });

    return NextResponse.json({ success: true, data: driver });
  } catch (error) {
    console.error("Error updating driver:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_ERROR", message: "Failed to update driver" } },
      { status: 500 }
    );
  }
}

// DELETE /api/drivers/[driverId] - Deactivate driver (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma();
    const { driverId } = await params;

    const existingDriver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!existingDriver) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    // Soft delete by setting status to INACTIVE and isActive to false
    await prisma.driver.update({
      where: { id: driverId },
      data: {
        isActive: false,
        status: "INACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Driver deactivated successfully" },
    });
  } catch (error) {
    console.error("Error deactivating driver:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_ERROR", message: "Failed to deactivate driver" } },
      { status: 500 }
    );
  }
}
