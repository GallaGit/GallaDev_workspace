"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Columns3,
  BarChart3,
  Mail,
  MailCheck,
  Workflow,
  Settings,
  Copy,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavChrome } from "@/components/layout/nav-chrome";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setAuthFlash } from "@/components/auth-flash-banner";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { useSessionAccess } from "@/components/session-access";
import { useUnreadCounts } from "@/components/correo/use-unread-counts";
import { formatUnreadBadge } from "@/lib/email/thread-state";

const NAV = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/inbox", labelKey: "nav.dailyWork", icon: Inbox },
  { href: "/leads", labelKey: "nav.leads", icon: Users },
  { href: "/kanban", labelKey: "nav.kanban", icon: Columns3 },
  { href: "/stats", labelKey: "nav.statistics", icon: BarChart3 },
  { href: "/email", labelKey: "nav.email", icon: Mail },
  { href: "/correo", labelKey: "nav.correo", icon: MailCheck },
  { href: "/automations", labelKey: "nav.automations", icon: Workflow },
  { href: "/duplicates", labelKey: "nav.duplicates", icon: Copy },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

const HIDDEN_FOR_VISITOR = new Set(["/email", "/correo", "/automations", "/settings"]);

export function AppSidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { open, close, navId } = useNavChrome();
  const { isVisitor, isAdmin } = useSessionAccess();
  const { counts: correoUnread } = useUnreadCounts(isAdmin && !isVisitor);
  const correoBadge = formatUnreadBadge(correoUnread.inbox);
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
    let visitor = isVisitor;
    if (!visitor) {
      try {
        const res = await fetch("/api/session");
        if (res.ok) {
          const data = (await res.json()) as { visitor?: unknown };
          visitor = data.visitor === true;
        }
      } catch {
        visitor = false;
      }
    }
    if (visitor) {
      try {
        await fetch("/api/demo/exit", { method: "POST" });
      } catch {
        // La cookie se intenta borrar igual; el login no abre datos reales.
      }
      router.push("/login");
      router.refresh();
      return;
    }
    setAuthFlash("goodbye");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Aun si falla la red, forzar salida al login.
    }
    router.push("/login");
  }

  return (
    <aside
      ref={asideRef}
      id={navId}
      data-app-sidebar
      role={drawerActive ? "dialog" : undefined}
      aria-modal={drawerActive ? true : undefined}
      aria-label={drawerActive ? t("nav.menuAria") : undefined}
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
          {t("nav.brand")}
        </span>
      </div>
      <nav
        className="flex flex-1 flex-col gap-0.5 p-2"
        aria-label={t("nav.principalAria")}
      >
        {NAV.filter(
          (item) => !isVisitor || !HIDDEN_FOR_VISITOR.has(item.href),
        ).map(({ href, labelKey, icon: Icon }) => {
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
              <span className="flex-1">{t(labelKey)}</span>
              {href === "/correo" && correoBadge ? (
                <span
                  className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-fg tabular-nums"
                  aria-label={t("nav.correoUnread", { count: correoUnread.inbox })}
                  data-testid="correo-unread-badge"
                >
                  {correoBadge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-1 p-3">
        <LocaleSwitcher className="mb-1 self-start" />
        <button
          type="button"
          onClick={handleLogout}
          tabIndex={isMobile && !open ? -1 : undefined}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-fg transition-colors hover:bg-muted hover:text-fg"
        >
          <LogOut className="h-4 w-4 opacity-70" />
          {isVisitor ? t("nav.exitDemo") : t("nav.logout")}
        </button>
        <div className="text-[11px] text-muted-fg">
          {t("nav.developedBy")}
        </div>
      </div>
    </aside>
  );
}
