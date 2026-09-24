"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionAccessProvider } from "@/components/session-access";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toast/toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <SessionAccessProvider>
          {children}
          <Toaster position="bottom-right" />
        </SessionAccessProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
