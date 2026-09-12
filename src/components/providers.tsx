"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toast/toast";

export function Providers({ children }: { children: React.ReactNode }) {
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
        <main className="h-screen bg-bg text-fg">
          <div className="flex h-screen w-screen">
            {/* Sidebar - 10% of screen, outside content area */}
            <aside className="w-[10%] flex h-full bg-sidebar border-r border-border">
              <AppSidebar />
            </aside>
            {/* Main content - 90% of screen with 10px margin from screen borders and visible shadow, gray background matching session selector */}
            <div className="w-[90%] flex-1 flex flex-col p-6 overflow-auto rounded-lg bg-gris-100 dark:bg-gris-800 shadow-md bg-bg/90 backdrop-none" style={{ margin: '10px' }}>
              {children}
            </div>
          </div>
        </main>
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}