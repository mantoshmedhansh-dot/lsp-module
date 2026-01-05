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
    const status = searchParams.get("status"); // OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED
    const category = searchParams.get("category");

    const where: any = {
      clientId: client.id,
    };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const [tickets, total, openCount, resolvedCount, closedCount] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          raisedBy: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          responses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.count({ where: { clientId: client.id, status: "OPEN" } }),
      prisma.supportTicket.count({ where: { clientId: client.id, status: "RESOLVED" } }),
      prisma.supportTicket.count({ where: { clientId: client.id, status: "CLOSED" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: tickets.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          category: t.category,
          subCategory: t.subCategory,
          subject: t.subject,
          description: t.description,
          priority: t.priority,
          status: t.status,
          orderId: t.orderId,
          awbNumber: t.awbNumber,
          raisedBy: t.raisedBy,
          assignedTo: t.assignedTo,
          resolution: t.resolution,
          slaDeadline: t.slaDeadline,
          isEscalated: t.isEscalated,
          lastResponseAt: t.responses[0]?.createdAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        summary: {
          open: openCount,
          resolved: resolvedCount,
          closed: closedCount,
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Client support error:", error);
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
      category,
      subCategory,
      subject,
      description,
      priority,
      orderId,
      awbNumber,
    } = body;

    // Validate required fields
    if (!category || !subject || !description) {
      return NextResponse.json(
        { success: false, error: "Category, subject and description are required" },
        { status: 400 }
      );
    }

    // Generate ticket number
    const ticketCount = await prisma.supportTicket.count();
    const ticketNumber = `TKT${Date.now().toString(36).toUpperCase()}${(ticketCount + 1).toString().padStart(5, "0")}`;

    // Calculate SLA deadline based on priority
    const slaHours: Record<string, number> = {
      URGENT: 4,
      HIGH: 12,
      MEDIUM: 24,
      LOW: 48,
    };
    const hours = slaHours[priority || "MEDIUM"] || 24;
    const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        clientId: client.id,
        category,
        subCategory,
        subject,
        description,
        priority: priority || "MEDIUM",
        orderId,
        awbNumber,
        raisedById: client.clientUserId,
        slaDeadline,
        status: "OPEN",
      },
    });

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
