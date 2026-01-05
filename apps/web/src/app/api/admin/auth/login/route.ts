import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ADMIN_ROLES = ["SUPER_ADMIN", "HUB_MANAGER", "OPERATOR"];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        assignedHub: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify admin role
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create admin session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        platform: "WEB_ADMIN",
        expiresAt,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          hubId: user.hubId,
          hubCode: user.assignedHub?.code || null,
          hubName: user.assignedHub?.name || null,
        },
        token,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
