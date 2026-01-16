/**
 * API Client Configuration
 *
 * This module configures the OpenAPI client to work with the
 * backend-centric architecture:
 *
 * Architecture Flow:
 * 1. Frontend calls /api/v1/* (relative URL)
 * 2. Next.js catch-all proxy at /api/v1/[...path]/route.ts
 * 3. Proxy extracts NextAuth session and adds headers:
 *    - X-User-Id
 *    - X-User-Role
 *    - X-Company-Id
 * 4. Request forwarded to FastAPI backend
 *
 * This approach:
 * - Uses cookie-based NextAuth session (no JWT token management)
 * - Centralizes auth handling in the proxy
 * - Works seamlessly with SSR and client-side rendering
 */

import { OpenAPI } from './generated';

/**
 * Configure the API client
 * Uses relative URLs to go through Next.js proxy
 */
export function configureApiClient(): void {
  // Empty BASE = relative URLs = goes through Next.js proxy
  // The proxy at /api/v1/[...path] handles auth and forwards to backend
  OpenAPI.BASE = '';

  // Include credentials for cookie-based session
  OpenAPI.CREDENTIALS = 'include';
  OpenAPI.WITH_CREDENTIALS = true;

  // Add response interceptor for error handling
  OpenAPI.interceptors.response.use((response: Response) => {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        // Don't redirect if already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return response;
  });
}

/**
 * Configure client for server-side requests (Server Components, API routes)
 * Allows passing user context directly without going through proxy
 */
export function configureServerClient(options?: {
  baseUrl?: string;
  userId?: string;
  userRole?: string;
  companyId?: string;
}): void {
  if (options?.baseUrl) {
    OpenAPI.BASE = options.baseUrl;
  }

  OpenAPI.HEADERS = {
    'Content-Type': 'application/json',
    ...(options?.userId && { 'X-User-Id': options.userId }),
    ...(options?.userRole && { 'X-User-Role': options.userRole }),
    ...(options?.companyId && { 'X-Company-Id': options.companyId }),
  };
}

// Auto-configure on import (client-side only)
if (typeof window !== 'undefined') {
  configureApiClient();
}

// Re-export the OpenAPI configuration
export { OpenAPI };

// Re-export all generated services and types for convenient imports
export * from './generated';
