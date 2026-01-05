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
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const limit = parseInt(searchParams.get("limit") || "0");
    const status = searchParams.get("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const where: any = {
      clientId: client.id,
    };

    if (status) {
      where.status = status;
    }

    if (fromDate) {
      where.requestedDate = { ...where.requestedDate, gte: new Date(fromDate) };
    }

    if (toDate) {
      where.requestedDate = { ...where.requestedDate, lte: new Date(toDate) };
    }

    const take = limit > 0 ? limit : pageSize;
    const skip = limit > 0 ? 0 : (page - 1) * pageSize;

    const [pickups, total] = await Promise.all([
      prisma.pickupRequest.findMany({
        where,
        orderBy: { requestedDate: "desc" },
        skip,
        take,
        include: {
          warehouse: {
            select: { id: true, name: true, code: true, address: true, city: true },
          },
        },
      }),
      prisma.pickupRequest.count({ where }),
    ]);

    // Transform for frontend
    const items = pickups.map((p) => ({
      id: p.id,
      pickupNumber: p.pickupNumber,
      warehouseId: p.warehouseId,
      warehouseName: p.warehouse.name,
      warehouseCode: p.warehouse.code,
      warehouseAddress: p.warehouse.address,
      warehouseCity: p.warehouse.city,
      requestedDate: p.requestedDate.toISOString(),
      timeSlotStart: p.timeSlotStart,
      timeSlotEnd: p.timeSlotEnd,
      expectedAwbs: p.expectedAwbs,
      expectedWeight: p.expectedWeight,
      pickedAwbs: p.pickedAwbs,
      pickedWeight: p.pickedWeight,
      status: p.status,
      assignedAgentName: p.assignedAgentName,
      assignedAgentPhone: p.assignedAgentPhone,
      pickedAt: p.pickedAt?.toISOString(),
      failedReason: p.failedReason,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: limit > 0 ? items : {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Client pickups error:", error);
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
      warehouseId,
      requestedDate,
      timeSlotStart,
      timeSlotEnd,
      expectedAwbs,
      expectedWeight,
    } = body;

    // Validate required fields
    if (!warehouseId || !requestedDate) {
      return NextResponse.json(
        { success: false, error: "Warehouse and requested date are required" },
        { status: 400 }
      );
    }

    // Verify warehouse belongs to client
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId, clientId: client.id },
    });

    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: "Invalid warehouse" },
        { status: 400 }
      );
    }

    // Generate pickup number
    const pickupCount = await prisma.pickupRequest.count({ where: { clientId: client.id } });
    const pickupNumber = `PKP${Date.now().toString(36).toUpperCase()}${(pickupCount + 1).toString().padStart(4, "0")}`;

    const pickup = await prisma.pickupRequest.create({
      data: {
        pickupNumber,
        clientId: client.id,
        warehouseId,
        requestedDate: new Date(requestedDate),
        timeSlotStart,
        timeSlotEnd,
        expectedAwbs: expectedAwbs || 0,
        expectedWeight,
        status: "SCHEDULED",
      },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: pickup,
    });
  } catch (error) {
    console.error("Create pickup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
