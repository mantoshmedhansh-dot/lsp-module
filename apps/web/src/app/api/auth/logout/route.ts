import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Deactivate the session
    await prisma.session.updateMany({
      where: { token },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
