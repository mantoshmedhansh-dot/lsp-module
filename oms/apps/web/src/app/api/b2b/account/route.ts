import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/account - Get B2B customer account information
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the B2B customer by email or portalUserId
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
      include: {
        priceList: { select: { name: true } },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      account: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        contactPerson: customer.contactPerson,
        gst: customer.gst,
        customerType: customer.type,
        status: customer.status,
        billingAddress: customer.billingAddress,
        shippingAddresses: customer.shippingAddresses,
        paymentTermType: customer.paymentTermType,
        paymentTermDays: customer.paymentTermDays,
        creditLimit: Number(customer.creditLimit || 0),
        creditUsed: Number(customer.creditUsed || 0),
        creditAvailable: Number(customer.creditAvailable || 0),
        priceList: customer.priceList?.name,
      },
    });
  } catch (error) {
    console.error("Error fetching B2B account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account information" },
      { status: 500 }
    );
  }
}

// PUT /api/b2b/account - Update B2B customer account information
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updates = await request.json();

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    // Only allow updating certain fields
    const allowedFields = ["phone", "alternatePhone", "shippingAddresses"];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Account updated successfully",
      account: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        phone: updatedCustomer.phone,
        shippingAddresses: updatedCustomer.shippingAddresses,
      },
    });
  } catch (error) {
    console.error("Error updating B2B account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}
