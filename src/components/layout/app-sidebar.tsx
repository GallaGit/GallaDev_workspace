"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <aside className="flex h-full w-55 shrink-0 flex-col bg-sidebar">
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="h-5 w-5 rounded bg-accent" />
        <span className="text-sm font-semibold tracking-tight text-fg">
          Leads_CRM
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
      <div className="p-3 text-[11px] text-muted-fg">
        Gestorías · Valencia
      </div>
    </aside>
  );
}
