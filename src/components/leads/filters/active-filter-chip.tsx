"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LeadFilters } from "@/lib/domain/lead";
import { clearedFields, type FilterDimension } from "./filter-config";
import { FilterValueEditor } from "./filter-value-editors";

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
  const Icon = dim.icon;
  const summary = dim.summary(filters);

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
            <span className="text-(--muted-fg)">{dim.label}</span>
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
        aria-label={`Quitar filtro ${dim.label}`}
        className="flex h-full items-center border-l border-(--border) px-1.5 py-1 text-(--muted-fg) transition-colors hover:bg-(--muted-hover) hover:text-(--fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo focus-visible:ring-inset"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
