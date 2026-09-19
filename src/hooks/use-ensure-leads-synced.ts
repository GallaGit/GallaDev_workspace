"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Lead } from "@/lib/domain/lead";
import type { DbHealth } from "@/lib/supabase/health";
import { useUiStore } from "@/store/ui-store";

export type SyncLeadsOptions = {
  /** Show success toast (manual sync). Default false for auto-sync. */
  notifySuccess?: boolean;
  /** Force sync even if leads already loaded. */
  force?: boolean;
};

/**
 * Shared leads sync used by Topbar and page hooks.
 */
export async function syncLeadsFromApi(
  options: SyncLeadsOptions = {},
): Promise<{ ok: boolean; count: number }> {
  const { setSync, setLeads, syncState, leads, lastSyncAt } = useUiStore.getState();

  if (!options.force && syncState === "syncing") {
    return { ok: false, count: leads.length };
  }

  if (
    !options.force &&
    lastSyncAt &&
    leads.length > 0
  ) {
    return { ok: true, count: leads.length };
  }

  setSync({ state: "syncing", error: null });
  try {
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error de sincronización");
    }
    setLeads(data.leads as Lead[]);
    setSync({ state: "idle", at: data.syncedAt, error: null });
    if (data.provider === "supabase") {
      useUiStore.getState().setDbProvider(data.provider);
    }
    // Semáforo de conexión (no bloquea el sync si falla).
    void refreshDbStatus();
    if (options.notifySuccess) {
      toast.success(`Sincronizado · ${data.count} leads`);
    }
    return { ok: true, count: data.count as number };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error de sync";
    setSync({ state: "error", error: message });
    toast.error(message);
    return { ok: false, count: 0 };
  }
}

/**
 * Consulta /api/db-status y guarda el semáforo en el store.
 * Se llama tras cada sync y al montar el Topbar.
 */
export async function refreshDbStatus(): Promise<void> {
  try {
    const res = await fetch("/api/db-status");
    const data = (await res.json()) as Partial<DbHealth>;
    if (
      (data.provider === "supabase") &&
      (data.status === "ok" ||
        data.status === "auth" ||
        data.status === "config" ||
        data.status === "down")
    ) {
      useUiStore.getState().setDbHealth({
        provider: data.provider,
        status: data.status,
        message: typeof data.message === "string" ? data.message : "",
        latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : 0,
      });
    }
  } catch {
    // Sin semáforo antes que un semáforo falso: el badge queda en "comprobando".
  }
}

/**
 * Ensures leads are loaded once per session when visiting a page that needs them.
 */
export function useEnsureLeadsSynced(options: { force?: boolean } = {}) {
  const started = useRef(false);
  const syncState = useUiStore((s) => s.syncState);
  const lastSyncAt = useUiStore((s) => s.lastSyncAt);
  const leadCount = useUiStore((s) => s.leads.length);

  const sync = useCallback(
    (opts?: SyncLeadsOptions) => syncLeadsFromApi(opts),
    [],
  );

  useEffect(() => {
    if (started.current && !options.force) return;
    started.current = true;
    void syncLeadsFromApi({ force: options.force });
  }, [options.force]);

  return { sync, syncState, lastSyncAt, leadCount };
}
