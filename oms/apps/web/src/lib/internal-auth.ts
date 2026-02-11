import { NextRequest } from "next/server";
import { auth } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lsp-oms-api.onrender.com';
const BACKEND_SERVICE_KEY = process.env.BACKEND_SERVICE_KEY || process.env.INTERNAL_API_KEY;

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

interface Company {
  id: string;
  locations?: Array<{ id: string }>;
}

/**
 * Check for either NextAuth session or internal API key
 * Returns session-like object for either auth method
 */
export async function getAuthOrInternal(request: NextRequest): Promise<InternalSession | null> {
  // Check for internal API key first
  const apiKey = request.headers.get("x-internal-api-key");

  if (apiKey === INTERNAL_API_KEY) {
    // Get the first company and location for internal requests via FastAPI
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (BACKEND_SERVICE_KEY) {
        headers['X-Service-Key'] = BACKEND_SERVICE_KEY;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/companies?limit=1`, {
        method: 'GET',
        headers,
      });

      let company: Company | null = null;
      if (response.ok) {
        const companies = await response.json();
        company = companies[0] || null;
      }

      return {
        user: {
          id: "internal-service",
          email: "internal@system.local",
          name: "Internal Service",
          role: "SUPER_ADMIN",
          companyId: company?.id || null,
          locationAccess: company?.locations?.map(l => l.id) || [],
        },
        isInternal: true,
      };
    } catch (error) {
      console.error("[Internal Auth] Error fetching company:", error);
      return {
        user: {
          id: "internal-service",
          email: "internal@system.local",
          name: "Internal Service",
          role: "SUPER_ADMIN",
          companyId: null,
          locationAccess: [],
        },
        isInternal: true,
      };
    }
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
