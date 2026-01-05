import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getAdminUser } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const clients = await prisma.client.findMany({
      orderBy: { companyName: "asc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            clientUsers: true,
            warehouses: true,
            orders: true,
            pickupRequests: true,
            supportTickets: true,
          },
        },
      },
    });

    // Format response
    const formattedClients = clients.map((client) => ({
      id: client.id,
      companyName: client.companyName,
      contactPerson: client.user?.name || "",
      email: client.user?.email || "",
      phone: client.user?.phone || "",
      gstNumber: client.gstNumber,
      billingAddress: client.billingAddress,
      status: "ACTIVE", // Client doesn't have a status field, so default to ACTIVE
      createdAt: client.createdAt.toISOString(),
      _count: {
        users: client._count.clientUsers,
        warehouses: client._count.warehouses,
        orders: client._count.orders,
        pickupRequests: client._count.pickupRequests,
        supportTickets: client._count.supportTickets,
      },
    }));

    return NextResponse.json({
      success: true,
      data: formattedClients,
    });
  } catch (error) {
    console.error("Admin clients error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
