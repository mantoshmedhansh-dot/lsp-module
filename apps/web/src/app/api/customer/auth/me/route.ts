import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

async function verifyCustomerAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = await prisma.customerSession.findUnique({
    where: { token },
    include: {
      client: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!session || !session.isActive || new Date() > session.expiresAt) {
    return null;
  }

  // Update last used
  await prisma.customerSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return session.client;
}

export async function GET(request: NextRequest) {
  try {
    const client = await verifyCustomerAuth(request);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: client.id,
        companyName: client.companyName,
        gstNumber: client.gstNumber,
        billingAddress: client.billingAddress,
        creditLimit: client.creditLimit,
        currentBalance: client.currentBalance,
        email: client.user.email,
        name: client.user.name,
        phone: client.user.phone,
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customer data" },
      { status: 500 }
    );
  }
}
