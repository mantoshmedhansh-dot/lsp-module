/**
 * Shared API helpers for normalizing backend responses and building query params.
 */

/**
 * Normalize an API response that might be an array or an object with a nested array.
 * Handles: [...], { items: [...] }, { data: [...] }, { <key>: [...] }
 */
export function normalizeArrayResponse<T = any>(
  data: unknown,
  key?: string
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    // Try specific key first
    if (key && Array.isArray(obj[key])) return obj[key] as T[];
    // Try common nested keys
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

/**
 * Normalize a paginated API response.
 * Returns { items, total, page, limit, totalPages, ...rest }
 */
export function normalizePaginatedResponse<T = any>(
  data: unknown,
  key?: string
): {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  raw: Record<string, unknown>;
} {
  if (!data) {
    return { items: [], total: 0, page: 1, limit: 25, totalPages: 1, raw: {} };
  }
  if (Array.isArray(data)) {
    return {
      items: data as T[],
      total: data.length,
      page: 1,
      limit: data.length,
      totalPages: 1,
      raw: {},
    };
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const items = normalizeArrayResponse<T>(data, key);
    return {
      items,
      total: (obj.total as number) || items.length,
      page: (obj.page as number) || 1,
      limit: (obj.limit as number) || 25,
      totalPages: (obj.totalPages as number) || 1,
      raw: obj,
    };
  }
  return { items: [], total: 0, page: 1, limit: 25, totalPages: 1, raw: {} };
}

/**
 * Build URLSearchParams from a filters object, skipping null/undefined/empty values.
 */
export function buildQueryParams(
  filters: Record<string, string | number | boolean | null | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}
