import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { z } from "zod";

const findNearestHubSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode (6 digits)"),
  type: z.enum(["PICKUP", "DELIVERY", "BOTH"]).default("DELIVERY"),
});

// POST /api/hubs/nearest - Find nearest hub for a pincode
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const validated = findNearestHubSchema.safeParse(body);

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

    const { pincode, type } = validated.data;

    // Find hub mappings for this pincode
    const typeCondition = type === "BOTH"
      ? { type: { in: ["BOTH", "PICKUP", "DELIVERY"] } }
      : { type: { in: [type, "BOTH"] } };

    const mappings = await prisma.hubPincodeMapping.findMany({
      where: {
        pincode,
        ...typeCondition,
        hub: {
          isActive: true,
        },
      },
      include: {
        hub: true,
      },
      orderBy: {
        priority: "asc",
      },
    });

    if (mappings.length > 0) {
      // Return the highest priority hub
      const bestMatch = mappings[0];
      return NextResponse.json({
        success: true,
        data: {
          hub: bestMatch.hub,
          mapping: {
            type: bestMatch.type,
            priority: bestMatch.priority,
          },
          matchType: "EXACT",
        },
      });
    }

    // If no exact match, try to find a hub in the same city/region
    // Get pincode info from PincodeMaster
    const pincodeInfo = await prisma.pincodeMaster.findUnique({
      where: { pincode },
    });

    if (pincodeInfo) {
      // Find hubs in the same city
      const cityHubs = await prisma.hub.findMany({
        where: {
          city: pincodeInfo.city,
          isActive: true,
        },
        orderBy: { sortingCapacity: "desc" },
        take: 1,
      });

      if (cityHubs.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            hub: cityHubs[0],
            mapping: null,
            matchType: "CITY",
          },
        });
      }

      // Find hubs in the same state
      const stateHubs = await prisma.hub.findMany({
        where: {
          state: pincodeInfo.state,
          isActive: true,
        },
        orderBy: { sortingCapacity: "desc" },
        take: 1,
      });

      if (stateHubs.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            hub: stateHubs[0],
            mapping: null,
            matchType: "STATE",
          },
        });
      }
    }

    // No hub found for this pincode
    return NextResponse.json({
      success: true,
      data: {
        hub: null,
        mapping: null,
        matchType: "NONE",
        message: "No hub found for this pincode",
      },
    });
  } catch (error) {
    console.error("Error finding nearest hub:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to find nearest hub" } },
      { status: 500 }
    );
  }
}
