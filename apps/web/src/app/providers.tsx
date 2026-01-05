"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { HubFilterProvider } from "@/contexts/HubFilterContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <HubFilterProvider>
          {children}
        </HubFilterProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
