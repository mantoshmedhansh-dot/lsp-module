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
          location: {
            select: { id: true, code: true, name: true },
          },
          company: {
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
      name: ch.name,
      isActive: ch.isActive,
      apiSyncStatus: ch.apiSyncStatus,
      syncFrequency: ch.syncFrequency,
      webhookUrl: ch.webhookUrl,
      location: ch.location,
      company: ch.company,
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
      locationId,
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

    // Verify location exists and belongs to company
    if (locationId) {
      const location = await prisma.location.findFirst({
        where: { id: locationId, companyId },
      });

      if (!location) {
        return NextResponse.json(
          { error: "Location not found or does not belong to company" },
          { status: 400 }
        );
      }
    }

    // Encrypt credentials if provided
    let apiCredentials = null;
    if (credentials) {
      // In production, this should be encrypted
      apiCredentials = JSON.stringify(credentials);
    }

    const channelConfig = await prisma.channelConfig.create({
      data: {
        channel,
        name,
        companyId,
        locationId: locationId || null,
        syncFrequency: syncFrequency || "MANUAL",
        apiCredentials,
        webhookUrl: webhookUrl || null,
        isActive: isActive !== false,
      },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
        company: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      id: channelConfig.id,
      channel: channelConfig.channel,
      name: channelConfig.name,
      isActive: channelConfig.isActive,
      syncFrequency: channelConfig.syncFrequency,
      location: channelConfig.location,
      company: channelConfig.company,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel configuration" },
      { status: 500 }
    );
  }
}
