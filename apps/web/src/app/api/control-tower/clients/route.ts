import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    // Fetch all clients with their shipment stats
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        companyName: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        companyName: "asc",
      },
    });

    // Get shipment counts per client
    const shipmentStats = await prisma.shipment.groupBy({
      by: ["clientId"],
      _count: {
        id: true,
      },
      where: {
        status: {
          notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"],
        },
      },
    });

    const statsMap = new Map(
      shipmentStats.map((s) => [s.clientId, s._count.id])
    );

    // Format response
    const clientsWithStats = clients.map((client) => ({
      id: client.id,
      companyName: client.companyName,
      email: client.user?.email || null,
      activeShipments: statsMap.get(client.id) || 0,
    }));

    // Sort by active shipments (highest first), then by name
    clientsWithStats.sort((a, b) => {
      if (b.activeShipments !== a.activeShipments) {
        return b.activeShipments - a.activeShipments;
      }
      return a.companyName.localeCompare(b.companyName);
    });

    return NextResponse.json({
      success: true,
      data: {
        clients: clientsWithStats,
        totalClients: clients.length,
        clientsWithActiveShipments: clientsWithStats.filter(
          (c) => c.activeShipments > 0
        ).length,
      },
    });
  } catch (error) {
    console.error("Control Tower Clients Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
