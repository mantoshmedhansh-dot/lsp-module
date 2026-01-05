import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: true });
    }

    const token = authHeader.substring(7);

    const prisma = await getPrisma();

    // Deactivate the session
    await prisma.session.updateMany({
      where: { token },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success - logout should never fail from user perspective
    return NextResponse.json({ success: true });
  }
}
