"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lead, LeadFilters, LeadStatus } from "@/lib/domain/lead";
import type { WorkQueueId } from "@/lib/leads/work-queues";
import type { DbProvider } from "@/lib/supabase/env";

export type SyncState = "idle" | "syncing" | "error";

interface UiState {
  selectedLeadId: string | null;
  selectedIds: string[];
  filters: LeadFilters;
  activeQueue: WorkQueueId | null;
  columnVisibility: Record<string, boolean>;
  lastSyncAt: string | null;
  syncState: SyncState;
  syncError: string | null;
  dbProvider: DbProvider | null;
  leads: Lead[];
  setSelectedLeadId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  setFilters: (f: Partial<LeadFilters>) => void;
  resetFilters: () => void;
  setActiveQueue: (queue: WorkQueueId | null) => void;
  setColumnVisibility: (v: Record<string, boolean>) => void;
  setLeads: (leads: Lead[]) => void;
  setDbProvider: (p: DbProvider) => void;
  upsertLead: (lead: Lead) => void;
  removeLead: (id: string) => void;
  setSync: (s: {
    state: SyncState;
    at?: string | null;
    error?: string | null;
  }) => void;
}

const defaultColumns: Record<string, boolean> = {
  companyName: true,
  status: true,
  city: true,
  province: true,
  employees: true,
  email: true,
  phone: true,
  score: true,
  favorite: true,
  lastActivity: true,
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      selectedLeadId: null,
      selectedIds: [],
      filters: {},
      activeQueue: null,
      columnVisibility: defaultColumns,
      lastSyncAt: null,
      syncState: "idle",
      syncError: null,
      dbProvider: null,
      leads: [],
      setSelectedLeadId: (id) => set({ selectedLeadId: id }),
      setSelectedIds: (ids) => set({ selectedIds: ids }),
      toggleSelectedId: (id) => {
        const cur = get().selectedIds;
        set({
          selectedIds: cur.includes(id)
            ? cur.filter((x) => x !== id)
            : [...cur, id],
        });
      },
      setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
      resetFilters: () => set({ filters: {} }),
      setActiveQueue: (queue) => set({ activeQueue: queue }),
      setColumnVisibility: (v) => set({ columnVisibility: v }),
      setLeads: (leads) => set({ leads }),
      setDbProvider: (p) => set({ dbProvider: p }),
      upsertLead: (lead) => {
        const existing = get().leads;
        const idx = existing.findIndex((l) => l.id === lead.id);
        if (idx === -1) {
          set({ leads: [lead, ...existing] });
          return;
        }
        const next = [...existing];
        next[idx] = lead;
        set({ leads: next });
      },
      removeLead: (id) =>
        set({
          leads: get().leads.filter((l) => l.id !== id),
          selectedLeadId:
            get().selectedLeadId === id ? null : get().selectedLeadId,
          selectedIds: get().selectedIds.filter((x) => x !== id),
        }),
      setSync: ({ state, at, error }) =>
        set({
          syncState: state,
          lastSyncAt: at !== undefined ? at : get().lastSyncAt,
          syncError: error !== undefined ? error : get().syncError,
        }),
    }),
    {
      name: "lead-crm-ui",
      partialize: (s) => ({
        columnVisibility: s.columnVisibility,
        filters: s.filters,
      }),
    },
  ),
);

export function statusColor(status: LeadStatus): string {
  const map: Record<LeadStatus, string> = {
    Nuevo: "bg-zinc-500/20 text-zinc-300",
    "Pendiente revisar": "bg-amber-500/20 text-amber-300",
    Validado: "bg-sky-500/20 text-sky-300",
    "Email preparado": "bg-violet-500/20 text-violet-300",
    "Email enviado": "bg-blue-500/20 text-blue-300",
    Respondió: "bg-orange-500/20 text-orange-300",
    Reunión: "bg-pink-500/20 text-pink-300",
    Cliente: "bg-emerald-500/20 text-emerald-300",
    Descartado: "bg-red-500/20 text-red-300",
  };
  return map[status];
}
