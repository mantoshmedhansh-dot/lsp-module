import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Find session
    const session = await prisma.clientUserSession.findUnique({
      where: { token },
      include: {
        clientUser: {
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                gstNumber: true,
                billingAddress: true,
                creditLimit: true,
                currentBalance: true,
              },
            },
          },
        },
      },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Update last used
    await prisma.clientUserSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    const { clientUser } = session;

    return NextResponse.json({
      success: true,
      data: {
        id: clientUser.id,
        email: clientUser.email,
        name: clientUser.name,
        phone: clientUser.phone,
        role: clientUser.role,
        client: clientUser.client,
      },
    });
  } catch (error) {
    console.error("Client /me error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
