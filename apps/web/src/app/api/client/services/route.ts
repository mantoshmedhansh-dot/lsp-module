import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

// Available services
const availableServices = [
  {
    code: "DOMESTIC_PARCEL",
    name: "Domestic Parcel",
    description: "Standard domestic parcel delivery across India",
    features: ["Pan-India coverage", "Weight up to 30kg", "2-7 days delivery"],
  },
  {
    code: "NEXT_DAY",
    name: "Next Day Delivery",
    description: "Express next day delivery for urgent shipments",
    features: ["Major cities", "Weight up to 10kg", "Next business day"],
  },
  {
    code: "B2B_CARGO",
    name: "Domestic B2B Cargo",
    description: "Part Truck Load cargo service for large shipments",
    features: ["Bulk shipments", "Weight 30kg+", "3-10 days delivery"],
  },
  {
    code: "INTRACITY",
    name: "Direct Intracity",
    description: "Same city delivery with bike or mini trucks",
    features: ["Same day delivery", "Live tracking", "Weight up to 50kg"],
  },
  {
    code: "CROSS_BORDER",
    name: "Cross Border Express",
    description: "International shipping to 220+ countries",
    features: ["Global reach", "Customs clearance", "5-15 days delivery"],
  },
  {
    code: "FTL",
    name: "Full Truck Load",
    description: "Book dedicated truck for large cargo",
    features: ["Dedicated vehicle", "Any weight", "Custom scheduling"],
  },
];

export async function GET(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get client's activated services
    const clientServices = await prisma.clientService.findMany({
      where: { clientId: client.id },
    });

    const serviceMap = new Map(clientServices.map((s) => [s.serviceCode, s]));

    // Combine available services with client activation status
    const services = availableServices.map((service) => {
      const clientService = serviceMap.get(service.code);
      return {
        ...service,
        status: clientService?.status || "INACTIVE",
        activatedAt: clientService?.activatedAt,
        customPricing: clientService?.customPricing
          ? JSON.parse(clientService.customPricing)
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Client services error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { serviceCode, action } = body;

    // Validate service code
    const service = availableServices.find((s) => s.code === serviceCode);
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Invalid service code" },
        { status: 400 }
      );
    }

    if (action === "activate") {
      // Request service activation
      const existingService = await prisma.clientService.findUnique({
        where: {
          clientId_serviceCode: {
            clientId: client.id,
            serviceCode,
          },
        },
      });

      if (existingService) {
        if (existingService.status === "ACTIVE") {
          return NextResponse.json(
            { success: false, error: "Service is already active" },
            { status: 400 }
          );
        }
        // Update to pending activation
        await prisma.clientService.update({
          where: { id: existingService.id },
          data: { status: "PENDING_ACTIVATION" },
        });
      } else {
        await prisma.clientService.create({
          data: {
            clientId: client.id,
            serviceCode,
            serviceName: service.name,
            status: "PENDING_ACTIVATION",
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Service activation requested. Our team will review and activate within 24 hours.",
      });
    } else if (action === "deactivate") {
      await prisma.clientService.updateMany({
        where: {
          clientId: client.id,
          serviceCode,
        },
        data: { status: "INACTIVE" },
      });

      return NextResponse.json({
        success: true,
        message: "Service deactivated successfully.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Service action error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
