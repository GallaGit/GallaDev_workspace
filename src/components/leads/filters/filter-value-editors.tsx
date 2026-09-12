"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadFilters } from "@/lib/domain/lead";
import type { FilterDimension } from "./filter-config";

function toggleInArray<T extends string>(arr: T[] | undefined, value: T): T[] {
  const cur = arr ?? [];
  return cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
}

function MultiSelectEditor({
  dim,
  filters,
  setFilters,
  options,
  searchable,
}: {
  dim: FilterDimension;
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
  options: string[];
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const field = dim.arrayField!;
  const selected = (filters[field] as string[] | undefined) ?? [];

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="flex flex-col">
      {searchable && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar ${dim.label.toLowerCase()}…`}
          className="mb-1 h-8 w-full rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--fg) placeholder:text-(--muted-fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo"
        />
      )}
      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-(--muted-fg)">
            Sin resultados
          </p>
        ) : (
          filtered.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  setFilters({
                    [field]: toggleInArray(selected, opt),
                  } as Partial<LeadFilters>)
                }
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-(--fg) transition-colors hover:bg-(--muted)"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    active
                      ? "border-(--accent) bg-(--accent) text-(--accent-fg)"
                      : "border-(--border)",
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{opt}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function BooleanEditor({
  dim,
  filters,
  setFilters,
}: {
  dim: FilterDimension;
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
}) {
  const field = dim.boolField!;
  const value = (filters[field] as boolean | null | undefined) ?? null;
  const opts: { label: string; val: boolean | null }[] = [
    { label: "Sí", val: true },
    { label: "No", val: false },
    { label: "Cualquiera", val: null },
  ];
  return (
    <div className="flex flex-col">
      {opts.map((o) => {
        const active = value === o.val;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() =>
              setFilters({ [field]: o.val } as Partial<LeadFilters>)
            }
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-(--fg) transition-colors hover:bg-(--muted)"
          >
            {o.label}
            {active && <Check className="h-3.5 w-3.5 text-(--accent)" />}
          </button>
        );
      })}
    </div>
  );
}

function NumRangeEditor({
  dim,
  filters,
  setFilters,
}: {
  dim: FilterDimension;
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
}) {
  const [fromField, toField] = dim.rangeFields!;
  const inputCls =
    "h-8 w-full rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--fg) placeholder:text-(--muted-fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo";
  return (
    <div className="flex items-center gap-2 p-1">
      <input
        type="number"
        placeholder="Mín"
        className={inputCls}
        value={(filters[fromField] as number | null) ?? ""}
        onChange={(e) =>
          setFilters({
            [fromField]: e.target.value ? Number(e.target.value) : null,
          } as Partial<LeadFilters>)
        }
      />
      <span className="text-(--muted-fg)">–</span>
      <input
        type="number"
        placeholder="Máx"
        className={inputCls}
        value={(filters[toField] as number | null) ?? ""}
        onChange={(e) =>
          setFilters({
            [toField]: e.target.value ? Number(e.target.value) : null,
          } as Partial<LeadFilters>)
        }
      />
    </div>
  );
}

function DateRangeEditor({
  dim,
  filters,
  setFilters,
}: {
  dim: FilterDimension;
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
}) {
  const [fromField, toField] = dim.rangeFields!;
  const inputCls =
    "h-8 w-full rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo";
  return (
    <div className="flex flex-col gap-2 p-1">
      <label className="flex flex-col gap-1 text-[11px] text-(--muted-fg)">
        Desde
        <input
          type="date"
          className={inputCls}
          value={(filters[fromField] as string | null) ?? ""}
          onChange={(e) =>
            setFilters({
              [fromField]: e.target.value || null,
            } as Partial<LeadFilters>)
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-(--muted-fg)">
        Hasta
        <input
          type="date"
          className={inputCls}
          value={(filters[toField] as string | null) ?? ""}
          onChange={(e) =>
            setFilters({
              [toField]: e.target.value || null,
            } as Partial<LeadFilters>)
          }
        />
      </label>
    </div>
  );
}

export function FilterValueEditor({
  dim,
  filters,
  setFilters,
  options,
}: {
  dim: FilterDimension;
  filters: LeadFilters;
  setFilters: (f: Partial<LeadFilters>) => void;
  /** Options for multi-select dimensions. */
  options?: string[];
}) {
  switch (dim.kind) {
    case "multi":
      return (
        <MultiSelectEditor
          dim={dim}
          filters={filters}
          setFilters={setFilters}
          options={options ?? []}
          searchable={dim.key === "city"}
        />
      );
    case "boolean":
      return (
        <BooleanEditor dim={dim} filters={filters} setFilters={setFilters} />
      );
    case "range-num":
      return (
        <NumRangeEditor dim={dim} filters={filters} setFilters={setFilters} />
      );
    case "range-date":
      return (
        <DateRangeEditor dim={dim} filters={filters} setFilters={setFilters} />
      );
    default:
      return null;
  }
}
