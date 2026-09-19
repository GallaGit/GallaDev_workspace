"use client";

import { useEffect } from "react";
import { Menu, Moon, Sun, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  refreshDbStatus,
  syncLeadsFromApi,
} from "@/hooks/use-ensure-leads-synced";
import { useUiStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import {
  NAV_MENU_BUTTON_ID,
  useNavChromeOptional,
} from "@/components/layout/nav-chrome";

const DB_DOT: Record<string, string> = {
  ok: "bg-emerald-500",
  auth: "bg-amber-500",
  config: "bg-amber-500",
  down: "bg-red-500",
};

export function Topbar({
  title,
  subtitle,
}: { title: string; subtitle?: string }) {
  const { theme, setTheme, mounted } = useTheme();
  const syncState = useUiStore((s) => s.syncState);
  const lastSyncAt = useUiStore((s) => s.lastSyncAt);
  const syncError = useUiStore((s) => s.syncError);
  const dbProvider = useUiStore((s) => s.dbProvider);
  const dbHealth = useUiStore((s) => s.dbHealth);
  const nav = useNavChromeOptional();
  const navOpen = nav?.open ?? false;
  const navId = nav?.navId;
  const navToggle = nav?.toggle;

  useEffect(() => {
    void refreshDbStatus();
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-blanco dark:bg-grafito px-4">
      <div className="flex min-w-0 items-center gap-2">
        {navToggle ? (
          <Button
            id={NAV_MENU_BUTTON_ID}
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={navToggle}
            aria-expanded={navOpen}
            aria-controls={navId}
            aria-label={navOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-grafito dark:text-gris-100">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gris-500 dark:text-gris-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {dbProvider && (
          <span
            title={
              dbHealth
                ? `${dbHealth.message} (${dbHealth.latencyMs} ms)`
                : "Comprobando conexión…"
            }
            className="flex items-center gap-1.5 rounded-full border border-gris-200 px-2 py-0.5 text-[11px] font-medium text-gris-500 dark:border-gris-700 dark:text-gris-400"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                dbHealth
                  ? (DB_DOT[dbHealth.status] ?? DB_DOT.down)
                  : "animate-pulse bg-zinc-400",
              )}
            />
            DB: Supabase
          </span>
        )}
        <div className="hidden text-sm text-gris-500 dark:text-gris-400 sm:block">
          {syncState === "syncing" && (
            <span className="flex items-center gap-1.5 text-info">
              <RefreshCw
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              Sincronizando…
            </span>
          )}
          {syncState === "error" && (
            <span className="flex items-center gap-1.5 text-error">
              Error: {syncError}
            </span>
          )}
          {syncState === "idle" && lastSyncAt && (
            <span>
              Última sync:{" "}
              {new Date(lastSyncAt).toLocaleString("es-ES", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void syncLeadsFromApi({ force: true, notifySuccess: true })
          }
          disabled={syncState === "syncing"}
          className="gap-1.5 px-2 sm:px-3"
          aria-label="Sincronizar"
          title="Sincronizar"
        >
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              syncState === "syncing" && "animate-spin",
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Sincronizar</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Cambiar tema"
        >
          {!mounted ? (
            <span className="h-4 w-4" />
          ) : theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </header>
  );
}
