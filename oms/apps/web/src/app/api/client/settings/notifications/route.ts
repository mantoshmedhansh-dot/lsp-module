import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

interface NotificationSettings {
  orderUpdates: boolean;
  shipmentAlerts: boolean;
  inventoryAlerts: boolean;
  weeklyReports: boolean;
  marketingEmails: boolean;
}

const defaultNotifications: NotificationSettings = {
  orderUpdates: true,
  shipmentAlerts: true,
  inventoryAlerts: true,
  weeklyReports: true,
  marketingEmails: false,
};

// GET /api/client/settings/notifications - Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        Company: {
          select: {
            id: true,
            settings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get notification settings from company settings
    const companySettings = user.Company?.settings as Record<string, unknown> | null;
    const notifications = {
      ...defaultNotifications,
      ...((companySettings?.notifications as Partial<NotificationSettings>) || {}),
    };

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/client/settings/notifications - Update notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderUpdates, shipmentAlerts, inventoryAlerts, weeklyReports, marketingEmails } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        Company: {
          select: {
            id: true,
            settings: true,
          },
        },
      },
    });

    if (!user || !user.companyId) {
      return NextResponse.json({ error: "User or company not found" }, { status: 404 });
    }

    // Build notification settings
    const notificationSettings: NotificationSettings = {
      orderUpdates: orderUpdates ?? true,
      shipmentAlerts: shipmentAlerts ?? true,
      inventoryAlerts: inventoryAlerts ?? true,
      weeklyReports: weeklyReports ?? true,
      marketingEmails: marketingEmails ?? false,
    };

    // Merge with existing company settings
    const existingSettings = (user.Company?.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...existingSettings,
      notifications: notificationSettings as unknown as Record<string, unknown>,
    };

    // Update company settings
    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        settings: updatedSettings as object,
      },
    });

    return NextResponse.json({
      ...notificationSettings,
      message: "Notification preferences updated successfully",
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}
