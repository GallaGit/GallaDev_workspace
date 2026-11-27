"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CorreoSidebar } from "@/components/correo/correo-sidebar";
import { CorreoWorkspaceProvider } from "@/components/correo/correo-workspace";
import { isCorreoPath } from "@/lib/email/correo-routes";
import { AuthFlashBanner } from "@/components/auth-flash-banner";
import { PendingAccess } from "@/components/auth/pending-access";
import { DemoBanner } from "@/components/demo/demo-banner";
import { useSessionAccess } from "@/components/session-access";
import {
  NavChromeProvider,
  useNavChrome,
} from "@/components/layout/nav-chrome";

const EDGE_PX = 24;
const SWIPE_DX = 50;

/**
 * Última página fuera de /correo: a ella vuelve el botón Atrás de la barra de
 * correo (o al dashboard si se entró directamente). Se ajusta durante el render
 * para que el valor esté ya en el primer pintado de /correo.
 */
function useReturnPath(pathname: string): string {
  const [state, setState] = useState<{ pathname: string; outside: string | null }>(
    () => ({ pathname, outside: isCorreoPath(pathname) ? null : pathname }),
  );
  if (state.pathname !== pathname) {
    setState({
      pathname,
      outside: isCorreoPath(pathname) ? state.outside : pathname,
    });
  }
  return state.outside ?? "/";
}

function AppShellChrome({
  children,
  correoChrome,
}: {
  children: React.ReactNode;
  /** true: la barra de correo sustituye a la barra general. */
  correoChrome: boolean;
}) {
  const { open, setOpen, close } = useNavChrome();
  const touchRef = useRef<{
    x: number;
    y: number;
    edge: boolean;
    onSidebar: boolean;
  } | null>(null);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (correoChrome) return;
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
    [open, correoChrome],
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
      {correoChrome ? <CorreoSidebar /> : <AppSidebar />}
      {open && !correoChrome ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2.5">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel shadow-md">
          <DemoBanner />
          <div className="px-4 pt-4">
            <AuthFlashBanner kind="welcome" />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useSessionAccess();
  const returnPath = useReturnPath(pathname);
  // El login se muestra sin el chrome de la app.
  if (pathname === "/login" || pathname === "/que-es") {
    return (
      <main className="h-full min-h-0 overflow-auto bg-sidebar text-fg">
        {children}
      </main>
    );
  }
  // Cuenta autenticada sin rol: no montar el CRM (evita listas vacías o errores).
  if (pathname === "/pending" || (access.ready && access.pending)) {
    return <PendingAccess />;
  }
  // En /correo la barra general se sustituye por la de correo. Viewer
  // (sin acceso al buzón) conserva la general; mientras se carga la sesión se
  // asume acceso al buzón para no parpadear.
  const correoChrome =
    isCorreoPath(pathname) && !access.isVisitor && (!access.ready || access.canUseCorreo);
  const chrome = (
    <NavChromeProvider>
      <AppShellChrome correoChrome={correoChrome}>{children}</AppShellChrome>
    </NavChromeProvider>
  );
  if (!correoChrome) return chrome;
  return (
    <CorreoWorkspaceProvider
      enabled={access.ready && access.canUseCorreo}
      backHref={returnPath}
    >
      {chrome}
    </CorreoWorkspaceProvider>
  );
}
