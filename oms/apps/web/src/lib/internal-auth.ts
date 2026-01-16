import { NextRequest } from "next/server";
import { auth } from "./auth";
import { prisma } from "@oms/database";

// Internal API key for service-to-service communication
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "cjd-internal-api-key-2024";

export interface InternalSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string | null;
    locationAccess: string[];
  };
  isInternal: boolean;
}

/**
 * Check for either NextAuth session or internal API key
 * Returns session-like object for either auth method
 */
export async function getAuthOrInternal(request: NextRequest): Promise<InternalSession | null> {
  // Check for internal API key first
  const apiKey = request.headers.get("x-internal-api-key");

  if (apiKey === INTERNAL_API_KEY) {
    // Get the first company and location for internal requests
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      include: {
        Location: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    return {
      user: {
        id: "internal-service",
        email: "internal@system.local",
        name: "Internal Service",
        role: "SUPER_ADMIN",
        companyId: company?.id || null,
        locationAccess: company?.Location.map(l => l.id) || [],
      },
      isInternal: true,
    };
  }

  // Fall back to NextAuth session
  const session = await auth();

  if (session?.user) {
    return {
      user: {
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name as string,
        role: session.user.role as string,
        companyId: session.user.companyId as string | null,
        locationAccess: session.user.locationAccess as string[],
      },
      isInternal: false,
    };
  }

  return null;
}
