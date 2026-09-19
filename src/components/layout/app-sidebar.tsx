"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Columns3,
  BarChart3,
  Mail,
  Workflow,
  Settings,
  Copy,
  LogOut,
  ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavChrome } from "@/components/layout/nav-chrome";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Daily Work", icon: Inbox },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/duplicates", label: "Duplicados", icon: Copy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { open, close, navId } = useNavChrome();
  const asideRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMobile(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const drawerActive = isMobile && open;

  // Focus trap + Escape while mobile drawer is open.
  useEffect(() => {
    if (!drawerActive) return;
    const panel = asideRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

    getFocusable()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerActive, close]);

  async function handleLogout() {
    close();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Aun si falla la red, forzar salida al login.
    }
    window.location.href = "/login";
  }

  async function handleLogoutAll() {
    close();
    try {
      await fetch("/api/auth/logout-all", { method: "POST" });
    } catch {
      /* force exit anyway */
    }
    window.location.href = "/login";
  }

  return (
    <aside
      ref={asideRef}
      id={navId}
      data-app-sidebar
      role={drawerActive ? "dialog" : undefined}
      aria-modal={drawerActive ? true : undefined}
      aria-label={drawerActive ? "Menú de navegación" : undefined}
      aria-hidden={isMobile && !open ? true : undefined}
      className={cn(
        "flex h-full w-55 flex-col bg-sidebar",
        // Mobile: fixed drawer; desktop (md+): static column as before.
        "fixed inset-y-0 left-0 z-50 transition-transform duration-150",
        "md:static md:z-auto md:shrink-0 md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="h-5 w-5 rounded bg-accent" />
        <span className="text-sm font-semibold tracking-tight text-fg">
          Leads_CRM
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Principal">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              tabIndex={isMobile && !open ? -1 : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-muted text-fg"
                  : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4 opacity-70" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-1 p-3">
        <button
          type="button"
          onClick={handleLogout}
          tabIndex={isMobile && !open ? -1 : undefined}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-fg transition-colors hover:bg-muted hover:text-fg"
        >
          <LogOut className="h-4 w-4 opacity-70" />
          Cerrar sesión
        </button>
        <button
          type="button"
          onClick={handleLogoutAll}
          tabIndex={isMobile && !open ? -1 : undefined}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-fg transition-colors hover:bg-muted hover:text-fg"
          title="Invalida la sesión en todos los dispositivos"
        >
          <ShieldOff className="h-4 w-4 opacity-70" />
          Cerrar todas las sesiones
        </button>
        <div className="text-[11px] text-muted-fg">developed by GallaDev</div>
      </div>
    </aside>
  );
}
