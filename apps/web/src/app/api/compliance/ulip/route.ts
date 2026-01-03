import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// ULIP API Base URL (Government portal)
const ULIP_BASE_URL = "https://api.goulip.in/v1";

// GET - List ULIP integrations and verifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const type = searchParams.get("type"); // integrations, verifications, tracking
    const vehicleId = searchParams.get("vehicleId");
    const status = searchParams.get("status");

    if (type === "verifications") {
      // Get vehicle verifications
      const where: any = {};
      if (vehicleId) where.vehicleId = vehicleId;
      if (status) where.verificationStatus = status;

      const verifications = await prisma.uLIPVehicleVerification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      // Get summary
      const summary = {
        total: verifications.length,
        verified: verifications.filter((v) => v.verificationStatus === "VERIFIED").length,
        pending: verifications.filter((v) => v.verificationStatus === "PENDING").length,
        failed: verifications.filter((v) => v.verificationStatus === "FAILED").length,
        expired: verifications.filter((v) => v.verificationStatus === "EXPIRED").length,
      };

      return NextResponse.json({
        success: true,
        data: { items: verifications, summary },
      });
    }

    if (type === "tracking") {
      // Get cargo tracking
      const where: any = {};
      if (status) where.trackingStatus = status;

      const tracking = await prisma.uLIPCargoTracking.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: 100,
      });

      return NextResponse.json({
        success: true,
        data: { items: tracking },
      });
    }

    // Default: Get integrations
    const where: any = {};
    if (clientId) where.clientId = clientId;

    const integrations = await prisma.uLIPIntegration.findMany({
      where,
      include: {
        _count: {
          select: {
            vehicleVerifications: true,
            cargoTrackings: true,
            syncLogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: { items: integrations },
    });
  } catch (error) {
    console.error("ULIP GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ULIP data" },
      { status: 500 }
    );
  }
}

// POST - Create integration or verify vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (action === "CREATE_INTEGRATION") {
      const { clientId, ulipUserName, ulipProviderId, apiKey, apiEndpoint } = data;

      if (!clientId || !ulipUserName) {
        return NextResponse.json(
          { success: false, error: "Client ID and ULIP username are required" },
          { status: 400 }
        );
      }

      const integration = await prisma.uLIPIntegration.create({
        data: {
          clientId,
          ulipUserName,
          ulipProviderId,
          apiKey,
          apiEndpoint: apiEndpoint || ULIP_BASE_URL,
          isActive: true,
          syncStatus: "PENDING",
        },
      });

      return NextResponse.json({
        success: true,
        data: integration,
        message: "ULIP integration created successfully",
      });
    }

    if (action === "VERIFY_VEHICLE") {
      const { ulipIntegrationId, registrationNo, vehicleId } = data;

      if (!ulipIntegrationId || !registrationNo) {
        return NextResponse.json(
          { success: false, error: "Integration ID and registration number are required" },
          { status: 400 }
        );
      }

      // Check if already verified
      const existing = await prisma.uLIPVehicleVerification.findFirst({
        where: {
          ulipIntegrationId,
          registrationNo,
          verificationStatus: "VERIFIED",
        },
      });

      if (existing && existing.expiryAt && existing.expiryAt > new Date()) {
        return NextResponse.json({
          success: true,
          data: existing,
          message: "Vehicle already verified",
        });
      }

      // Simulate ULIP API call (in production, call actual ULIP API)
      // const ulipResponse = await callULIPVehicleAPI(registrationNo);

      // Mock response for development
      const mockResponse = {
        status: "SUCCESS",
        refNumber: `ULIP-${Date.now()}`,
        ownerName: "Mock Owner Name",
        vehicleClass: "LMV",
        fuelType: "DIESEL",
        insuranceProvider: "ICICI Lombard",
        insurancePolicyNo: `POL-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        insuranceExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        fitnessExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        permitExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      const verification = await prisma.uLIPVehicleVerification.create({
        data: {
          ulipIntegrationId,
          vehicleId,
          registrationNo,
          verificationStatus: mockResponse.status === "SUCCESS" ? "VERIFIED" : "FAILED",
          verifiedAt: new Date(),
          expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
          ulipRefNumber: mockResponse.refNumber,
          ulipResponse: JSON.stringify(mockResponse),
          ownerName: mockResponse.ownerName,
          vehicleClass: mockResponse.vehicleClass,
          fuelType: mockResponse.fuelType,
          insuranceProvider: mockResponse.insuranceProvider,
          insurancePolicyNo: mockResponse.insurancePolicyNo,
          insuranceExpiry: mockResponse.insuranceExpiry,
          fitnessExpiry: mockResponse.fitnessExpiry,
          permitExpiry: mockResponse.permitExpiry,
        },
      });

      // Log the sync
      await prisma.uLIPSyncLog.create({
        data: {
          ulipIntegrationId,
          syncType: "VEHICLE_VERIFICATION",
          status: "SUCCESS",
          recordsProcessed: 1,
          recordsFailed: 0,
          response: JSON.stringify(mockResponse),
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: verification,
        message: "Vehicle verified successfully",
      });
    }

    if (action === "START_CARGO_TRACKING") {
      const {
        ulipIntegrationId,
        shipmentId,
        tripId,
        originLocation,
        destinationLocation,
        vehicleNo,
        cargoWeight,
        cargoValue,
        sealNumber,
      } = data;

      if (!ulipIntegrationId || !originLocation || !destinationLocation) {
        return NextResponse.json(
          { success: false, error: "Integration ID and locations are required" },
          { status: 400 }
        );
      }

      const cargoTrackingId = `CARGO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const tracking = await prisma.uLIPCargoTracking.create({
        data: {
          ulipIntegrationId,
          shipmentId,
          tripId,
          cargoTrackingId,
          originLocation,
          destinationLocation,
          vehicleNo,
          cargoWeight,
          cargoValue,
          sealNumber,
          trackingStatus: "ACTIVE",
          startedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: tracking,
        message: "Cargo tracking started",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("ULIP POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process ULIP request" },
      { status: 500 }
    );
  }
}

// PATCH - Update tracking or sync
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 }
      );
    }

    if (action === "UPDATE_CARGO_LOCATION") {
      const { latitude, longitude, currentLocation } = data;

      const tracking = await prisma.uLIPCargoTracking.update({
        where: { id },
        data: {
          lastLatitude: latitude,
          lastLongitude: longitude,
          currentLocation,
          lastLocationUpdate: new Date(),
          lastSyncAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: tracking,
        message: "Location updated",
      });
    }

    if (action === "COMPLETE_TRACKING") {
      const tracking = await prisma.uLIPCargoTracking.update({
        where: { id },
        data: {
          trackingStatus: "COMPLETED",
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: tracking,
        message: "Tracking completed",
      });
    }

    if (action === "TOGGLE_INTEGRATION") {
      const integration = await prisma.uLIPIntegration.findUnique({
        where: { id },
      });

      if (!integration) {
        return NextResponse.json(
          { success: false, error: "Integration not found" },
          { status: 404 }
        );
      }

      const updated = await prisma.uLIPIntegration.update({
        where: { id },
        data: { isActive: !integration.isActive },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Integration ${updated.isActive ? "activated" : "deactivated"}`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("ULIP PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ULIP data" },
      { status: 500 }
    );
  }
}
