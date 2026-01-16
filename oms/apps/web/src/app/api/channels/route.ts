import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/channels - List all channel configurations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const channel = searchParams.get("channel") || "";
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by company for non-super admins
    if (session.user.role !== "SUPER_ADMIN" && session.user.companyId) {
      where.companyId = session.user.companyId;
    }

    if (channel) {
      where.channel = channel;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { channel: { contains: search, mode: "insensitive" } },
      ];
    }

    const [channels, total] = await Promise.all([
      prisma.channelConfig.findMany({
        where,
        include: {
          Company: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.channelConfig.count({ where }),
    ]);

    // Map to frontend format
    const formattedChannels = channels.map((ch) => ({
      id: ch.id,
      channel: ch.channel,
      name: ch.displayName,
      isActive: ch.isActive,
      apiSyncStatus: ch.syncStatus,
      syncFrequency: ch.syncFrequency,
      webhookUrl: ch.webhookUrl,
      company: ch.Company,
      lastSyncAt: ch.lastSyncAt,
      createdAt: ch.createdAt,
    }));

    return NextResponse.json({
      data: formattedChannels,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

// POST /api/channels - Create a new channel configuration
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      channel,
      name,
      syncFrequency,
      credentials,
      webhookUrl,
      isActive,
    } = body;

    if (!channel || !name) {
      return NextResponse.json(
        { error: "Channel and name are required" },
        { status: 400 }
      );
    }

    // Determine companyId
    let companyId = session.user.companyId;
    if (session.user.role === "SUPER_ADMIN" && body.companyId) {
      companyId = body.companyId;
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "Company is required" },
        { status: 400 }
      );
    }

    const channelConfig = await prisma.channelConfig.create({
      data: {
        channel,
        displayName: name,
        companyId,
        syncFrequency: syncFrequency || "HOURLY",
        credentials: credentials || undefined,
        webhookUrl: webhookUrl || null,
        isActive: isActive !== false,
      },
      include: {
        Company: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      id: channelConfig.id,
      channel: channelConfig.channel,
      name: channelConfig.displayName,
      isActive: channelConfig.isActive,
      syncFrequency: channelConfig.syncFrequency,
      company: channelConfig.Company,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel configuration" },
      { status: 500 }
    );
  }
}
