import { NextRequest } from "next/server";
import { getPrisma } from "@cjdquick/database";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  hubId: string | null;
  isActive: boolean;
}

const ADMIN_ROLES = ["SUPER_ADMIN", "HUB_MANAGER", "OPERATOR"];

export async function getAdminUser(request: NextRequest): Promise<AdminUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const prisma = await getPrisma();
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            hubId: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.isActive || new Date() > session.expiresAt) {
      return null;
    }

    if (!session.user.isActive) {
      return null;
    }

    // Verify user has admin role
    if (!ADMIN_ROLES.includes(session.user.role)) {
      return null;
    }

    // Update last used timestamp
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return session.user;
  } catch (error) {
    console.error("Error verifying admin auth:", error);
    return null;
  }
}

export async function getHubIdsForUser(user: AdminUser): Promise<string[] | null> {
  // Super Admin has access to all hubs (return null to indicate no filter)
  if (user.role === "SUPER_ADMIN") {
    return null;
  }

  if (!user.hubId) {
    return [];
  }

  try {
    const prisma = await getPrisma();

    if (user.role === "OPERATOR") {
      // Operator only sees their assigned hub
      return [user.hubId];
    }

    if (user.role === "HUB_MANAGER") {
      // Hub Manager sees assigned hub + all child hubs (recursive)
      const hubIds: string[] = [user.hubId];

      // Get child hubs recursively (2 levels deep for performance)
      const childHubs = await prisma.hub.findMany({
        where: {
          OR: [
            { parentHubId: user.hubId },
            { parentHub: { parentHubId: user.hubId } },
          ],
          isActive: true,
        },
        select: { id: true },
      });

      hubIds.push(...childHubs.map((h) => h.id));
      return hubIds;
    }

    return [user.hubId];
  } catch (error) {
    console.error("Error getting hub IDs for user:", error);
    return user.hubId ? [user.hubId] : [];
  }
}

export function buildHubFilter(
  hubIds: string[] | null,
  requestedHubId?: string | null,
  fieldName: string = "currentHubId"
): Record<string, any> | undefined {
  // If hubIds is null, user has access to all hubs
  if (hubIds === null) {
    // If a specific hub is requested, filter by it
    if (requestedHubId) {
      return { [fieldName]: requestedHubId };
    }
    // No filter needed
    return undefined;
  }

  // If user has limited hub access
  if (hubIds.length === 0) {
    // No access - return impossible filter
    return { [fieldName]: "NO_ACCESS" };
  }

  // If specific hub requested, verify it's in allowed list
  if (requestedHubId) {
    if (hubIds.includes(requestedHubId)) {
      return { [fieldName]: requestedHubId };
    }
    // Requested hub not allowed
    return { [fieldName]: "NO_ACCESS" };
  }

  // Filter by all allowed hubs
  if (hubIds.length === 1) {
    return { [fieldName]: hubIds[0] };
  }

  return { [fieldName]: { in: hubIds } };
}
