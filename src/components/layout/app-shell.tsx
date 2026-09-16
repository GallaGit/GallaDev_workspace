"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // El login se muestra sin el chrome de la app.
  if (pathname === "/login") {
    return (
      <main className="h-full min-h-0 overflow-auto bg-sidebar text-fg">
        {children}
      </main>
    );
  }
  return (
    <main className="flex h-full min-h-0 overflow-hidden bg-sidebar text-fg">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2.5">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-gris-100 shadow-md dark:bg-gris-800">
          {children}
        </div>
      </div>
    </main>
  );
}
