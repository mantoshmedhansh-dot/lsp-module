import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, deviceId, deviceName, platform } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is disabled" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if user has a valid role for mobile app
    const mobileRoles = ["PICKUP_AGENT", "DELIVERY_AGENT", "HUB_OPERATOR", "ADMIN"];
    if (!mobileRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied. Mobile app is only for field agents." },
        { status: 403 }
      );
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        deviceId,
        deviceName,
        platform,
        expiresAt,
      },
    });

    // Get hub info if user is assigned to one
    let hubCode = null;
    if (user.hubId) {
      const hub = await prisma.hub.findUnique({
        where: { id: user.hubId },
        select: { code: true },
      });
      hubCode = hub?.code;
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          hubId: user.hubId,
          hubCode,
        },
        token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}
