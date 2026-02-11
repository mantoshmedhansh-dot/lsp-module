/**
 * Server-side API Client for Next.js API Routes
 *
 * This module provides utilities for making authenticated requests
 * to the FastAPI backend from Next.js API routes (server-side).
 *
 * For client-side usage, use the regular api client from '@/lib/api'.
 */

import { OpenAPI } from './generated';
import { auth } from '../auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lsp-oms-api.onrender.com';

// Service-to-service authentication for backend calls
const BACKEND_SERVICE_KEY = process.env.BACKEND_SERVICE_KEY || process.env.INTERNAL_API_KEY;

/**
 * Configure OpenAPI client for server-side use with service auth
 */
export function configureServerClient(): void {
  OpenAPI.BASE = API_BASE_URL;

  // For server-side, we use service-to-service auth header
  // The FastAPI backend should be configured to accept this
  if (BACKEND_SERVICE_KEY) {
    OpenAPI.HEADERS = {
      'X-Service-Key': BACKEND_SERVICE_KEY,
    };
  }
}

/**
 * Configure OpenAPI client with a specific JWT token
 */
export function configureWithToken(token: string): void {
  OpenAPI.BASE = API_BASE_URL;
  OpenAPI.TOKEN = token;
}

/**
 * Get current user's session for passing context to backend
 */
export async function getServerSession() {
  return await auth();
}

/**
 * Create query string from params object
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * Make an authenticated fetch request to the FastAPI backend
 * This is a lower-level helper for cases where the generated client doesn't fit
 */
export async function fetchFromBackend<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add authentication
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  } else if (BACKEND_SERVICE_KEY) {
    requestHeaders['X-Service-Key'] = BACKEND_SERVICE_KEY;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auto-configure on import
configureServerClient();

// Re-export generated services for server-side use
export * from './generated';
