/**
 * Catch-All API Proxy Route
 *
 * This route proxies all /api/v1/* requests to the FastAPI backend.
 * It handles authentication via session or internal service key.
 *
 * Routes NOT handled here (handled separately):
 * - /api/auth/* - NextAuth authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://lsp-oms-api.onrender.com";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "internal-service-key";

/**
 * Get authentication headers for backend request
 */
async function getAuthHeaders(request: NextRequest): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Check for internal service key first
  const serviceKey = request.headers.get("X-Service-Key");
  if (serviceKey === INTERNAL_API_KEY) {
    headers["X-Service-Key"] = serviceKey;

    // Forward user context if provided
    const userId = request.headers.get("X-User-Id");
    const userRole = request.headers.get("X-User-Role");
    const companyId = request.headers.get("X-Company-Id");

    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;
    if (companyId) headers["X-Company-Id"] = companyId;

    return headers;
  }

  // Otherwise, get session from NextAuth
  const session = await auth();
  if (session?.user) {
    headers["X-User-Id"] = session.user.id;
    headers["X-User-Role"] = session.user.role || "";
    if (session.user.companyId) {
      headers["X-Company-Id"] = session.user.companyId;
    }
  }

  return headers;
}

/**
 * Build backend URL from request path
 */
function buildBackendUrl(request: NextRequest, path: string[]): string {
  const backendPath = `/api/v1/${path.join("/")}`;
  const url = new URL(request.url);
  const queryString = url.search;
  return `${API_BASE_URL}${backendPath}${queryString}`;
}

/**
 * Proxy request to backend
 */
async function proxyToBackend(
  request: NextRequest,
  path: string[],
  method: string
): Promise<NextResponse> {
  try {
    const backendUrl = buildBackendUrl(request, path);
    const headers = await getAuthHeaders(request);

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Include body for POST, PUT, PATCH requests
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON - that's okay for some requests
      }
    }

    const response = await fetch(backendUrl, fetchOptions);

    // Handle 204 No Content (common for DELETE)
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // Get response data
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType?.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        // Empty JSON response
        data = null;
      }
    } else {
      const text = await response.text();
      // Try to parse as JSON if it looks like JSON
      if (text && (text.startsWith("{") || text.startsWith("["))) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      } else {
        data = text || null;
      }
    }

    // Return response with same status
    if (data === null || data === "") {
      return new NextResponse(null, { status: response.status });
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[API Proxy] Error proxying ${method} to /${path.join("/")}:`, error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 500 }
    );
  }
}

// HTTP Method Handlers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "PUT");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "DELETE");
}
