"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LeadFilters } from "@/lib/domain/lead";
import { type FilterDimension, type FilterKey } from "./filter-config";
import { FilterValueEditor } from "./filter-value-editors";

export function AddFilterPopover({
  inactiveDims,
  filters,
  setFilters,
  optionsFor,
  compact,
}: {
  inactiveDims: FilterDimension[];
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
  optionsFor: (key: FilterKey) => string[] | undefined;
  /** Show only the icon (used when filters already exist). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<FilterDimension | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return inactiveDims;
    const q = query.toLowerCase();
    return inactiveDims.filter((d) => d.label.toLowerCase().includes(q));
  }, [inactiveDims, query]);

  function reset() {
    setTimeout(() => {
      setView(null);
      setQuery("");
    }, 150);
  }

  function selectDim(dim: FilterDimension) {
    // Booleans have no list to pick from: seed `true` so the chip is active.
    if (dim.kind === "boolean" && dim.boolField) {
      setFilters({ [dim.boolField]: true } as Partial<LeadFilters>);
    }
    setView(dim);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="gap-1.5"
        >
          <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
          {!compact && "Filtrar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        {view ? (
          <div className="flex flex-col">
            <div className="mb-1 flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-(--muted-fg)">
              <view.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {view.label}
            </div>
            <FilterValueEditor
              dim={view}
              filters={filters}
              setFilters={setFilters}
              options={optionsFor(view.key)}
            />
          </div>
        ) : (
          <div className="flex flex-col">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por…"
              className="mb-1 h-8 w-full rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--fg) placeholder:text-(--muted-fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo"
            />
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-(--muted-fg)">
                  Sin filtros disponibles
                </p>
              ) : (
                filtered.map((dim) => {
                  const Icon = dim.icon;
                  return (
                    <button
                      key={dim.key}
                      type="button"
                      onClick={() => selectDim(dim)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-(--fg) transition-colors hover:bg-(--muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo focus-visible:ring-inset"
                    >
                      <Icon
                        className="h-3.5 w-3.5 text-(--muted-fg)"
                        aria-hidden="true"
                      />
                      {dim.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
