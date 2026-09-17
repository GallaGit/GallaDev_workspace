"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  NavChromeProvider,
  useNavChrome,
} from "@/components/layout/nav-chrome";

const EDGE_PX = 24;
const SWIPE_DX = 50;

function AppShellChrome({ children }: { children: React.ReactNode }) {
  const { open, setOpen, close } = useNavChrome();
  const touchRef = useRef<{
    x: number;
    y: number;
    edge: boolean;
    onSidebar: boolean;
  } | null>(null);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (window.matchMedia("(min-width: 768px)").matches) return;
      const t = e.touches[0];
      if (!t) return;
      const target = e.target as Element | null;
      const onSidebar = Boolean(target?.closest?.("[data-app-sidebar]"));
      const edge = !open && t.clientX < EDGE_PX;
      if (!edge && !onSidebar) {
        touchRef.current = null;
        return;
      }
      touchRef.current = {
        x: t.clientX,
        y: t.clientY,
        edge,
        onSidebar,
      };
    },
    [open],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      const start = touchRef.current;
      if (!start) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Cancel if vertical scroll dominates.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        touchRef.current = null;
        return;
      }
      if (start.edge && dx > SWIPE_DX) {
        setOpen(true);
        touchRef.current = null;
        return;
      }
      if (start.onSidebar && open && dx < -SWIPE_DX) {
        close();
        touchRef.current = null;
      }
    },
    [close, open, setOpen],
  );

  const onTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  useEffect(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onTouchEnd, onTouchMove, onTouchStart]);

  return (
    <main className="flex h-full min-h-0 overflow-hidden bg-sidebar text-fg">
      <AppSidebar />
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2.5">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-gris-100 shadow-md dark:bg-gris-800">
          {children}
        </div>
      </div>
    </main>
  );
}

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
    <NavChromeProvider>
      <AppShellChrome>{children}</AppShellChrome>
    </NavChromeProvider>
  );
}
