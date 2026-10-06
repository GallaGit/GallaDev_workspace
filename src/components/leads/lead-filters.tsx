"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Search, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { useSessionAccess } from "@/components/session-access";
import { useUiStore } from "@/store/ui-store";
import {
  FILTER_DIMENSIONS,
  type FilterKey,
} from "@/components/leads/filters/filter-config";
import { ActiveFilterChip } from "@/components/leads/filters/active-filter-chip";
import { AddFilterPopover } from "@/components/leads/filters/add-filter-popover";

export function LeadFiltersBar() {
  const t = useTranslations();
  const locale = useLocale();
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
  const { canWriteLeads } = useSessionAccess();

  async function recalculateScores() {
    if (!canWriteLeads) return;
    setScoring(true);
    try {
      const body = selectedIds.length > 0 ? { ids: selectedIds } : {};
      const res = await fetch("/api/leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("leads.toasts.scoreError"));
      for (const lead of (data.leads as Lead[]) ?? []) {
        upsertLead(lead);
      }
      const scope =
        selectedIds.length > 0
          ? t("leads.toasts.selectedScope", { count: selectedIds.length })
          : t("leads.toasts.allActiveScope");
      toast.success(
        t("leads.toasts.scoreResult", {
          scope,
          scored: data.scored,
          total: data.total,
        }) +
          (data.failed
            ? t("leads.toasts.scoreFailed", { failed: data.failed })
            : ""),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("leads.toasts.scoreError"),
      );
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
    return [...set].sort((a, b) => a.localeCompare(b, locale));
  }, [leads, locale]);

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
        toast.error(t("leads.toasts.identifyUserError"));
        return;
      }
      setFilters({ responsibleId: user.id });
    } catch {
      toast.error(t("leads.toasts.myLeadsError"));
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
          placeholder={t("leads.filters.search")}
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
          {t("leads.filters.myLeads")}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-(--muted)"
            onClick={() => setFilters({ responsibleId: null })}
            aria-label={t("leads.filters.removeMyLeads")}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void toggleMine()}
          title={t("leads.filters.myLeadsHint")}
        >
          <User className="h-3.5 w-3.5" />
          {t("leads.filters.myLeads")}
        </Button>
      )}

      {/* Active queue chip */}
      {activeQueue && (
        <span className="inline-flex items-center gap-1 rounded-md border border-(--accent) bg-(--accent)/15 px-2 py-1 text-xs text-(--fg)">
          {t("leads.filters.queue", {
            name: t(`queues.${activeQueue}.title`),
          })}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-(--muted)"
            onClick={clearQueue}
            aria-label={t("leads.filters.removeQueue")}
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
          {t("leads.filters.clear")}
        </Button>
      )}

      {canWriteLeads ? (
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={scoring}
            onClick={() => void recalculateScores()}
            title={
              selectedIds.length > 0
                ? t("leads.filters.scoreSelected", {
                    count: selectedIds.length,
                  })
                : t("leads.filters.scoreAll")
            }
          >
            <Calculator className="h-3.5 w-3.5" />
            {scoring
              ? t("leads.filters.scoring")
              : t("leads.filters.recalculateScores")}
          </Button>
          <CreateLeadDialog />
        </div>
      ) : null}
    </div>
  );
}
