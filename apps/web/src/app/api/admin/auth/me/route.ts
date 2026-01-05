import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    const user = await getAdminUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get hub info if user has a hubId
    let hubInfo = null;
    if (user.hubId) {
      const prisma = await getPrisma();
      const hub = await prisma.hub.findUnique({
        where: { id: user.hubId },
        select: { id: true, code: true, name: true, type: true },
      });
      hubInfo = hub;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hubId: user.hubId,
        hubCode: hubInfo?.code || null,
        hubName: hubInfo?.name || null,
      },
    });
  } catch (error) {
    console.error("Get admin user error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get user info" },
      { status: 500 }
    );
  }
}
