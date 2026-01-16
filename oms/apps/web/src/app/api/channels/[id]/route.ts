import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/channels/[id] - Get a single channel configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const channelConfig = await prisma.channelConfig.findUnique({
      where: { id },
      include: {
        Company: {
          select: { id: true, name: true },
        },
      },
    });

    if (!channelConfig) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check access
    if (
      session.user.role !== "SUPER_ADMIN" &&
      channelConfig.companyId !== session.user.companyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: channelConfig.id,
      channel: channelConfig.channel,
      name: channelConfig.displayName,
      isActive: channelConfig.isActive,
      apiSyncStatus: channelConfig.syncStatus,
      syncFrequency: channelConfig.syncFrequency,
      webhookUrl: channelConfig.webhookUrl,
      company: channelConfig.Company,
      lastSyncAt: channelConfig.lastSyncAt,
      createdAt: channelConfig.createdAt,
      // Don't expose credentials
    });
  } catch (error) {
    console.error("Error fetching channel:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel" },
      { status: 500 }
    );
  }
}

// PATCH /api/channels/[id] - Update a channel configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, syncFrequency, credentials, webhookUrl, isActive } = body;

    // Check if channel exists
    const existingChannel = await prisma.channelConfig.findUnique({
      where: { id },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check access
    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingChannel.companyId !== session.user.companyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.displayName = name;
    if (syncFrequency !== undefined) updateData.syncFrequency = syncFrequency;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update credentials if provided
    if (credentials) {
      updateData.credentials = credentials;
    }

    const channelConfig = await prisma.channelConfig.update({
      where: { id },
      data: updateData,
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
      apiSyncStatus: channelConfig.syncStatus,
      syncFrequency: channelConfig.syncFrequency,
      webhookUrl: channelConfig.webhookUrl,
      company: channelConfig.Company,
    });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[id] - Delete a channel configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if channel exists
    const existingChannel = await prisma.channelConfig.findUnique({
      where: { id },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check access
    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingChannel.companyId !== session.user.companyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if channel has synced orders
    const orderCount = await prisma.order.count({
      where: { channel: existingChannel.channel },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete channel with ${orderCount} synced orders. Deactivate it instead.`
        },
        { status: 400 }
      );
    }

    await prisma.channelConfig.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Channel deleted successfully" });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}
