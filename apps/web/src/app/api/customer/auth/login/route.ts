import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        client: true,
      },
    });

    if (!user || !user.client) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify role is CLIENT
    if (user.role !== "CLIENT") {
      return NextResponse.json(
        { success: false, error: "This portal is for customers only" },
        { status: 403 }
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

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is deactivated" },
        { status: 403 }
      );
    }

    // Generate session token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create customer session
    await prisma.customerSession.create({
      data: {
        clientId: user.client.id,
        token,
        expiresAt,
        deviceInfo: request.headers.get("user-agent") || undefined,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresAt,
        client: {
          id: user.client.id,
          companyName: user.client.companyName,
          gstNumber: user.client.gstNumber,
          email: user.email,
          name: user.name,
          phone: user.phone,
        },
      },
    });
  } catch (error) {
    console.error("Customer login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}
