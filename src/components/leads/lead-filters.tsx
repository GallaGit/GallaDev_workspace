"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Search, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
import {
  LEAD_STATUSES,
  PROVINCES,
  type Lead,
  type LeadFilters,
} from "@/lib/domain/lead";
import { CANONICAL_CITIES } from "@/lib/geo/cities";
import { getWorkQueueTitle } from "@/lib/leads/work-queues";
import { useUiStore } from "@/store/ui-store";
import {
  FILTER_DIMENSIONS,
  type FilterKey,
} from "@/components/leads/filters/filter-config";
import { ActiveFilterChip } from "@/components/leads/filters/active-filter-chip";
import { AddFilterPopover } from "@/components/leads/filters/add-filter-popover";

export function LeadFiltersBar() {
  const {
    filters,
    setFilters,
    resetFilters,
    leads,
    activeQueue,
    setActiveQueue,
    selectedIds,
    upsertLead,
  } = useUiStore();
  const [scoring, setScoring] = useState(false);
  const router = useRouter();

  async function recalculateScores() {
    setScoring(true);
    try {
      const body = selectedIds.length > 0 ? { ids: selectedIds } : {};
      const res = await fetch("/api/leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al puntuar");
      for (const lead of (data.leads as Lead[]) ?? []) {
        upsertLead(lead);
      }
      const scope =
        selectedIds.length > 0
          ? `${selectedIds.length} seleccionados`
          : "todos los activos";
      toast.success(
        `Scores recalculados (${scope}): ${data.scored}/${data.total}` +
          (data.failed ? ` · fallidos: ${data.failed}` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al puntuar");
    } finally {
      setScoring(false);
    }
  }

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.cityCanonical) set.add(l.cityCanonical);
    }
    for (const c of CANONICAL_CITIES) set.add(c);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leads]);

  const optionsFor = (key: FilterKey): string[] | undefined => {
    switch (key) {
      case "status":
        return [...LEAD_STATUSES];
      case "province":
        return [...PROVINCES];
      case "city":
        return cities;
      default:
        return undefined;
    }
  };

  const activeDims = FILTER_DIMENSIONS.filter((d) => d.isActive(filters));
  const inactiveDims = FILTER_DIMENSIONS.filter((d) => !d.isActive(filters));
  const myOnly = filters.responsibleId != null;

  const hasActive =
    Boolean(filters.search) ||
    activeDims.length > 0 ||
    Boolean(activeQueue) ||
    myOnly;

  async function toggleMine() {
    if (myOnly) {
      setFilters({ responsibleId: null });
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No se pudo identificar tu usuario");
        return;
      }
      setFilters({ responsibleId: user.id });
    } catch {
      toast.error("No se pudo activar el filtro Mis leads");
    }
  }

  function clearQueue() {
    setActiveQueue(null);
    router.replace("/leads", { scroll: false });
  }

  function clearAll() {
    resetFilters();
    setActiveQueue(null);
    router.replace("/leads", { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--border) bg-(--panel) px-4 py-2.5">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--muted-fg)" />
        <input
          placeholder="Buscar empresa, dominio, email…"
          className="h-8 w-64 max-w-[60vw] rounded-md border border-(--border) bg-(--bg) pl-8 pr-2 text-sm text-(--fg) placeholder:text-(--muted-fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo"
          value={filters.search ?? ""}
          onChange={(e) =>
            setFilters({ search: e.target.value || undefined } as Partial<LeadFilters>)
          }
        />
      </div>

      {/* Mis leads */}
      {myOnly ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-(--accent) bg-(--accent)/15 px-2 py-1 text-xs text-(--fg)">
          <User className="h-3 w-3" aria-hidden="true" />
          Mis leads
          <button
            type="button"
            className="rounded p-0.5 hover:bg-(--muted)"
            onClick={() => setFilters({ responsibleId: null })}
            aria-label="Quitar filtro Mis leads"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void toggleMine()}
          title="Mostrar solo los leads asignados a ti"
        >
          <User className="h-3.5 w-3.5" />
          Mis leads
        </Button>
      )}

      {/* Active queue chip */}
      {activeQueue && (
        <span className="inline-flex items-center gap-1 rounded-md border border-(--accent) bg-(--accent)/15 px-2 py-1 text-xs text-(--fg)">
          Cola: {getWorkQueueTitle(activeQueue)}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-(--muted)"
            onClick={clearQueue}
            aria-label="Quitar cola"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}

      {/* Active filter chips */}
      {activeDims.map((dim) => (
        <ActiveFilterChip
          key={dim.key}
          dim={dim}
          filters={filters}
          setFilters={setFilters}
          options={optionsFor(dim.key)}
        />
      ))}

      {/* Add filter */}
      {inactiveDims.length > 0 && (
        <AddFilterPopover
          inactiveDims={inactiveDims}
          filters={filters}
          setFilters={setFilters}
          optionsFor={optionsFor}
          compact={activeDims.length > 0}
        />
      )}

      {/* Clear all */}
      {hasActive && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={scoring}
          onClick={() => void recalculateScores()}
          title={
            selectedIds.length > 0
              ? `Recalcular score de ${selectedIds.length} seleccionados`
              : "Recalcular score de todos los leads activos"
          }
        >
          <Calculator className="h-3.5 w-3.5" />
          {scoring ? "Puntuando…" : "Recalcular scores"}
        </Button>
        <CreateLeadDialog />
      </div>
    </div>
  );
}
