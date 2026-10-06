"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LeadFilters } from "@/lib/domain/lead";
import { leadStatusLabel } from "@/lib/i18n/lead-status-label";
import { clearedFields, type FilterDimension } from "./filter-config";
import { FilterValueEditor } from "./filter-value-editors";

function dateFromInput(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

export function ActiveFilterChip({
  dim,
  filters,
  setFilters,
  options,
}: {
  dim: FilterDimension;
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
  options?: string[];
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("leads.filters");
  const tStatus = useTranslations("leadStatus");
  const tProvince = useTranslations("province");
  const format = useFormatter();
  const Icon = dim.icon;
  const label = t(dim.key);
  const summary = (() => {
    if (dim.kind === "multi" && dim.arrayField) {
      const values = filters[dim.arrayField] ?? [];
      if (values.length === 1) {
        const value = values[0];
        if (dim.key === "status") return leadStatusLabel(tStatus, value);
        if (dim.key === "province") {
          return tProvince(value as "Valencia" | "Alicante" | "Castellón" | "Otra");
        }
        return value;
      }
      return t(
        dim.key === "status" ? "selectedMasculine" : "selectedFeminine",
        { count: values.length },
      );
    }
    if (dim.kind === "boolean" && dim.boolField) {
      return filters[dim.boolField] ? t("yes") : t("no");
    }
    if (dim.kind === "range-num" && dim.rangeFields) {
      const [fromField, toField] = dim.rangeFields;
      const min = filters[fromField] as number | null | undefined;
      const max = filters[toField] as number | null | undefined;
      if (min != null && max != null) return `${min}–${max}`;
      if (min != null) return `≥ ${min}`;
      if (max != null) return `≤ ${max}`;
      return "";
    }
    if (dim.kind === "range-date" && dim.rangeFields) {
      const [fromField, toField] = dim.rangeFields;
      const from = filters[fromField] as string | null | undefined;
      const to = filters[toField] as string | null | undefined;
      const formatDate = (value: string) => {
        const date = dateFromInput(value);
        return date
          ? format.dateTime(date, { day: "2-digit", month: "2-digit" })
          : value;
      };
      if (from && to) return `${formatDate(from)}–${formatDate(to)}`;
      if (from) return t("fromDate", { date: formatDate(from) });
      if (to) return t("toDate", { date: formatDate(to) });
    }
    return "";
  })();

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-(--border) bg-(--muted) text-xs">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 text-(--fg) transition-colors hover:bg-(--muted-hover)",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo focus-visible:ring-inset",
            )}
          >
            <Icon className="h-3.5 w-3.5 text-(--muted-fg)" aria-hidden="true" />
            <span className="text-(--muted-fg)">{label}</span>
            <span className="font-medium">{summary}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <FilterValueEditor
            dim={dim}
            filters={filters}
            setFilters={setFilters}
            options={options}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => setFilters(clearedFields(dim))}
        aria-label={t("remove", { label })}
        className="flex h-full items-center border-l border-(--border) px-1.5 py-1 text-(--muted-fg) transition-colors hover:bg-(--muted-hover) hover:text-(--fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo focus-visible:ring-inset"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
