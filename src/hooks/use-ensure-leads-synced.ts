"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Lead } from "@/lib/domain/lead";
import { useUiStore } from "@/store/ui-store";

export type SyncLeadsOptions = {
  /** Show success toast (manual sync). Default false for auto-sync. */
  notifySuccess?: boolean;
  /** Force sync even if leads already loaded. */
  force?: boolean;
};

/**
 * Shared Notion sync used by Topbar and page hooks.
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
    if (data.provider === "supabase" || data.provider === "notion") {
      useUiStore.getState().setDbProvider(data.provider);
    }
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
