import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

export async function GET(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = {
      clientId: client.id,
    };

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        address: w.address,
        pincode: w.pincode,
        city: w.city,
        state: w.state,
        contactName: w.contactName,
        contactPhone: w.contactPhone,
        isActive: w.isActive,
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    console.error("Client facilities error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      address,
      pincode,
      city,
      state,
      contactName,
      contactPhone,
    } = body;

    // Validate required fields
    if (!name || !address || !pincode || !city || !state || !contactName || !contactPhone) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }

    // Generate warehouse code
    const warehouseCount = await prisma.warehouse.count({ where: { clientId: client.id } });
    const code = `${client.companyName.substring(0, 3).toUpperCase()}_WH_${(warehouseCount + 1).toString().padStart(3, "0")}`;

    const warehouse = await prisma.warehouse.create({
      data: {
        clientId: client.id,
        name,
        code,
        address,
        pincode,
        city,
        state,
        contactName,
        contactPhone,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: warehouse,
    });
  } catch (error) {
    console.error("Create facility error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
