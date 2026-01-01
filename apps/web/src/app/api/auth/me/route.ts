import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Find active session
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            hubId: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      return NextResponse.json(
        { success: false, error: "Session expired" },
        { status: 401 }
      );
    }

    // Check if user is still active
    if (!session.user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is disabled" },
        { status: 401 }
      );
    }

    // Update last used time
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    // Get hub info
    let hubCode = null;
    if (session.user.hubId) {
      const hub = await prisma.hub.findUnique({
        where: { id: session.user.hubId },
        select: { code: true },
      });
      hubCode = hub?.code;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone,
        role: session.user.role,
        hubId: session.user.hubId,
        hubCode,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get user info" },
      { status: 500 }
    );
  }
}
