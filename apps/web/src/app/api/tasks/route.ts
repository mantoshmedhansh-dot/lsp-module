import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Helper to verify auth token
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || !session.isActive || new Date() > session.expiresAt) {
    return null;
  }

  return session.user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const date = searchParams.get("date");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const where: any = {
      assignedToId: user.id,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.scheduledDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [
          { priority: "desc" },
          { sequence: "asc" },
          { scheduledDate: "asc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: tasks,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only allow admin or hub operators to create tasks
    if (!["ADMIN", "HUB_OPERATOR"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Generate task number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.task.count({
      where: {
        taskNumber: {
          startsWith: `TSK${dateStr}`,
        },
      },
    });
    const taskNumber = `TSK${dateStr}${String(count + 1).padStart(4, "0")}`;

    const task = await prisma.task.create({
      data: {
        taskNumber,
        assignedToId: body.assignedToId,
        hubId: body.hubId,
        type: body.type,
        priority: body.priority || 1,
        sequence: body.sequence || 0,
        shipmentId: body.shipmentId,
        awbNumber: body.awbNumber,
        tripId: body.tripId,
        consignmentId: body.consignmentId,
        address: body.address,
        pincode: body.pincode,
        city: body.city,
        latitude: body.latitude,
        longitude: body.longitude,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        isCod: body.isCod || false,
        codAmount: body.codAmount || 0,
        scheduledDate: new Date(body.scheduledDate),
        timeSlotStart: body.timeSlotStart,
        timeSlotEnd: body.timeSlotEnd,
        notes: body.notes,
      },
    });

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create task" },
      { status: 500 }
    );
  }
}
