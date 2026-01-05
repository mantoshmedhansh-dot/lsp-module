import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@cjdquick/database";

interface HubWithChildren {
  id: string;
  code: string;
  name: string;
  type: string;
  parentHubId: string | null;
  childHubs?: HubWithChildren[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAdminUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const prisma = await getPrisma();
    let hubs: { id: string; code: string; name: string; type: string; parentHubId: string | null }[] = [];

    if (user.role === "SUPER_ADMIN") {
      // Super Admin sees all active hubs
      hubs = await prisma.hub.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentHubId: true,
        },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      });
    } else if (user.role === "HUB_MANAGER" && user.hubId) {
      // Hub Manager sees assigned hub + child hubs
      const assignedHub = await prisma.hub.findUnique({
        where: { id: user.hubId },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentHubId: true,
        },
      });

      if (assignedHub) {
        hubs.push(assignedHub);

        // Get direct child hubs
        const directChildren = await prisma.hub.findMany({
          where: {
            parentHubId: user.hubId,
            isActive: true,
          },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            parentHubId: true,
          },
          orderBy: { code: "asc" },
        });
        hubs.push(...directChildren);

        // Get grandchild hubs (2 levels deep)
        if (directChildren.length > 0) {
          const grandChildren = await prisma.hub.findMany({
            where: {
              parentHubId: { in: directChildren.map((h) => h.id) },
              isActive: true,
            },
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              parentHubId: true,
            },
            orderBy: { code: "asc" },
          });
          hubs.push(...grandChildren);
        }
      }
    } else if (user.role === "OPERATOR" && user.hubId) {
      // Operator sees only their assigned hub
      const hub = await prisma.hub.findUnique({
        where: { id: user.hubId },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentHubId: true,
        },
      });

      if (hub) {
        hubs = [hub];
      }
    }

    return NextResponse.json({
      success: true,
      data: hubs,
    });
  } catch (error) {
    console.error("Error fetching allowed hubs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch hubs" },
      { status: 500 }
    );
  }
}
