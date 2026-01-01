import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const [items, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              serviceability: true,
              orders: true,
            },
          },
        },
      }),
      prisma.partner.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching partners:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch partners" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const partner = await prisma.partner.create({
      data: {
        code: body.code,
        name: body.name,
        displayName: body.displayName,
        apiBaseUrl: body.apiBaseUrl,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        webhookUrl: body.webhookUrl,
        webhookSecret: body.webhookSecret,
        supportsCod: body.supportsCod ?? true,
        supportsReverse: body.supportsReverse ?? false,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: partner }, { status: 201 });
  } catch (error) {
    console.error("Error creating partner:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create partner" },
      { status: 500 }
    );
  }
}
