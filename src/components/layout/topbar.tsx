"use client";

import { Moon, Sun, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { syncLeadsFromApi } from "@/hooks/use-ensure-leads-synced";
import { useUiStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

export function Topbar({
  title,
  subtitle,
}: { title: string; subtitle?: string }) {
  const { theme, setTheme, mounted } = useTheme();
  const syncState = useUiStore((s) => s.syncState);
  const lastSyncAt = useUiStore((s) => s.lastSyncAt);
  const syncError = useUiStore((s) => s.syncError);
  const dbProvider = useUiStore((s) => s.dbProvider);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-blanco dark:bg-grafito px-4">
      <div>
        <h1 className="text-lg font-semibold text-grafito dark:text-gris-100">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gris-500 dark:text-gris-400">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {dbProvider && (
          <span
            title={`Fuente de datos activa: ${dbProvider === "supabase" ? "Supabase" : "Notion"}`}
            className="rounded-full border border-gris-200 px-2 py-0.5 text-[11px] font-medium text-gris-500 dark:border-gris-700 dark:text-gris-400"
          >
            DB: {dbProvider === "supabase" ? "Supabase" : "Notion"}
          </span>
        )}
        <div className="hidden text-sm text-gris-500 dark:text-gris-400 sm:block">
          {syncState === "syncing" && (
            <span className="flex items-center gap-1.5 text-info">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
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
          onClick={() => void syncLeadsFromApi({ force: true, notifySuccess: true })}
          disabled={syncState === "syncing"}
          className="gap-1.5"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5 transition-transform", syncState === "syncing" && "animate-spin")}
          />
          Sincronizar
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