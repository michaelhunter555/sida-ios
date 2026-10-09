import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { api } from "@/lib/api";
import type { Bundle } from "@/lib/types";

export const bundleKey = (id: string) => ["bundle", id] as const;

/** The full claim bundle, cached by TanStack and refreshed on focus or when a socket notification invalidates it. */
export function useBundle(id: string) {
  const query = useQuery({
    queryKey: bundleKey(id),
    queryFn: () => api<Bundle>(`/api/claims/${id}/bundle`),
    enabled: Boolean(id),
    staleTime: 10_000,
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return {
    data: query.data ?? null,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Could not load claim") : null,
    loading: query.isPending,
    reload: async () => {
      await refetch();
    },
  };
}
