/**
 * NDR React Query Hooks
 *
 * These hooks provide type-safe data fetching for NDR-related operations
 * using the generated OpenAPI client and TanStack Query.
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useNdrList({ page: 1, limit: 50 });
 * const { data: stats } = useNdrSummary();
 * ```
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listNdrsApiV1NdrGet,
  getNdrSummaryApiV1NdrSummaryGet,
  getNdrApiV1NdrNdrIdGet,
  updateNdrApiV1NdrNdrIdPatch,
  resolveNdrApiV1NdrNdrIdResolvePost,
  createOutreachApiV1NdrNdrIdOutreachPost,
  type ListNdrsApiV1NdrGetData,
  type UpdateNdrApiV1NdrNdrIdPatchData,
  type ResolveNdrApiV1NdrNdrIdResolvePostData,
  type CreateOutreachApiV1NdrNdrIdOutreachPostData,
} from "@/lib/api/client";

// Query keys for cache management
export const ndrKeys = {
  all: ["ndr"] as const,
  lists: () => [...ndrKeys.all, "list"] as const,
  list: (filters: ListNdrsApiV1NdrGetData) =>
    [...ndrKeys.lists(), filters] as const,
  details: () => [...ndrKeys.all, "detail"] as const,
  detail: (id: string) => [...ndrKeys.details(), id] as const,
  summary: () => [...ndrKeys.all, "summary"] as const,
};

/**
 * Hook to fetch paginated NDR list with filters
 */
export function useNdrList(params: ListNdrsApiV1NdrGetData = {}) {
  return useQuery({
    queryKey: ndrKeys.list(params),
    queryFn: () => listNdrsApiV1NdrGet(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch NDR summary statistics
 */
export function useNdrSummary() {
  return useQuery({
    queryKey: ndrKeys.summary(),
    queryFn: () => getNdrSummaryApiV1NdrSummaryGet(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch a single NDR by ID
 */
export function useNdrDetail(ndrId: string, enabled = true) {
  return useQuery({
    queryKey: ndrKeys.detail(ndrId),
    queryFn: () => getNdrApiV1NdrNdrIdGet({ ndrId }),
    enabled: enabled && !!ndrId,
  });
}

/**
 * Hook to update an NDR
 */
export function useUpdateNdr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNdrApiV1NdrNdrIdPatchData) =>
      updateNdrApiV1NdrNdrIdPatch(data),
    onSuccess: (_, variables) => {
      // Invalidate the specific NDR and the list
      queryClient.invalidateQueries({ queryKey: ndrKeys.detail(variables.ndrId) });
      queryClient.invalidateQueries({ queryKey: ndrKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ndrKeys.summary() });
    },
  });
}

/**
 * Hook to resolve an NDR
 */
export function useResolveNdr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ResolveNdrApiV1NdrNdrIdResolvePostData) =>
      resolveNdrApiV1NdrNdrIdResolvePost(data),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ndrKeys.detail(variables.ndrId) });
      queryClient.invalidateQueries({ queryKey: ndrKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ndrKeys.summary() });
    },
  });
}

/**
 * Hook to create an outreach attempt
 */
export function useCreateOutreach() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOutreachApiV1NdrNdrIdOutreachPostData) =>
      createOutreachApiV1NdrNdrIdOutreachPost(data),
    onSuccess: (_, variables) => {
      // Invalidate the NDR detail to refresh outreach list
      queryClient.invalidateQueries({ queryKey: ndrKeys.detail(variables.ndrId) });
    },
  });
}
