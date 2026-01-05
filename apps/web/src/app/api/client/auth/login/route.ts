import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find client user
    const clientUser = await prisma.clientUser.findUnique({
      where: { email },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            gstNumber: true,
          },
        },
      },
    });

    if (!clientUser) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!clientUser.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is inactive. Please contact support." },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, clientUser.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create session
    await prisma.clientUserSession.create({
      data: {
        clientUserId: clientUser.id,
        token,
        expiresAt,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        deviceInfo: request.headers.get("user-agent") || "unknown",
      },
    });

    // Update last login
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: clientUser.id,
          email: clientUser.email,
          name: clientUser.name,
          phone: clientUser.phone,
          role: clientUser.role,
        },
        client: clientUser.client,
      },
    });
  } catch (error) {
    console.error("Client login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
