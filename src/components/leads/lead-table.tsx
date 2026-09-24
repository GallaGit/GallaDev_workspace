"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { Lead, LeadStatus } from "@/lib/domain/lead";
import { LEAD_STATUSES } from "@/lib/domain/lead";
import { filterLeads } from "@/lib/leads/filter-leads";
import { useSessionAccess } from "@/components/session-access";
import { statusColor, useUiStore } from "@/store/ui-store";
import { toast } from "sonner";

async function patchLead(id: string, patch: Partial<Lead>) {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar");
  return data.lead as Lead;
}

type ColKey =
  | "favorite"
  | "companyName"
  | "status"
  | "city"
  | "province"
  | "employees"
  | "email"
  | "phone"
  | "score"
  | "lastActivity";

const COL_LABELS: Record<ColKey, string> = {
  favorite: "★",
  companyName: "Empresa",
  status: "Estado",
  city: "Ciudad",
  province: "Provincia",
  employees: "Empl.",
  email: "Email",
  phone: "Teléfono",
  score: "Score",
  lastActivity: "Actividad",
};

export function LeadTable() {
  const {
    leads,
    filters,
    activeQueue,
    columnVisibility,
    setColumnVisibility,
    selectedLeadId,
    setSelectedLeadId,
    selectedIds,
    setSelectedIds,
    toggleSelectedId,
    upsertLead,
  } = useUiStore();
  const { canWriteLeads } = useSessionAccess();

  const [sortKey, setSortKey] = useState<ColKey>("lastActivity");
  const [sortDesc, setSortDesc] = useState(true);

  const data = useMemo(() => {
    const filtered = filterLeads(leads, filters, activeQueue);
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), "es", {
        numeric: true,
      });
      return sortDesc ? -cmp : cmp;
    });
  }, [leads, filters, activeQueue, sortKey, sortDesc]);

  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  const visibleCols = (Object.keys(COL_LABELS) as ColKey[]).filter(
    (k) => columnVisibility[k] !== false,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-2 border-b border-(--border) px-4 py-2">
        <span className="self-center text-[11px] text-(--muted-fg)">
          Columnas
        </span>
        {(Object.keys(COL_LABELS) as ColKey[]).map((key) => (
          <label
            key={key}
            className="flex items-center gap-1 text-[11px] text-(--muted-fg)"
          >
            <input
              type="checkbox"
              checked={columnVisibility[key] !== false}
              onChange={() =>
                setColumnVisibility({
                  ...columnVisibility,
                  [key]: columnVisibility[key] === false,
                })
              }
            />
            {COL_LABELS[key]}
          </label>
        ))}
        <span className="ml-auto text-[11px] text-(--muted-fg)">
          {data.length} leads
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-(--panel)">
            <tr className="border-b border-(--border)">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={
                    data.length > 0 && selectedIds.length === data.length
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked ? data.map((l) => l.id) : [],
                    )
                  }
                  aria-label="Seleccionar todos"
                />
              </th>
              {visibleCols.map((key) => (
                <th
                  key={key}
                  className="cursor-pointer px-3 py-2 font-medium text-(--muted-fg)"
                  onClick={() => toggleSort(key)}
                >
                  {COL_LABELS[key]}
                  {sortKey === key ? (sortDesc ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + 1}
                  className="px-3 py-12 text-center text-(--muted-fg)"
                >
                  No hay leads. Pulsa Sincronizar o ajusta los filtros.
                </td>
              </tr>
            ) : (
              data.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`cursor-pointer border-b border-(--border) hover:bg-(--muted) ${
                    selectedLeadId === lead.id ? "bg-(--muted)" : ""
                  }`}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => toggleSelectedId(lead.id)}
                      aria-label="Seleccionar"
                    />
                  </td>
                  {visibleCols.map((key) => (
                    <td key={key} className="px-3 py-2 align-middle">
                      <Cell
                        col={key}
                        lead={lead}
                        canWrite={canWriteLeads}
                        onPatch={async (patch) => {
                          if (!canWriteLeads) return;
                          try {
                            const updated = await patchLead(lead.id, patch);
                            upsertLead(updated);
                            if (patch.status) toast.success("Estado actualizado");
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Error",
                            );
                          }
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({
  col,
  lead,
  canWrite,
  onPatch,
}: {
  col: ColKey;
  lead: Lead;
  canWrite: boolean;
  onPatch: (patch: Partial<Lead>) => void;
}) {
  switch (col) {
    case "favorite":
      if (!canWrite) {
        return (
          <Star
            className={`h-3.5 w-3.5 ${
              lead.favorite
                ? "fill-amber-400 text-amber-400"
                : "text-(--muted-fg)"
            }`}
          />
        );
      }
      return (
        <button
          type="button"
          className="p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ favorite: !lead.favorite });
          }}
        >
          <Star
            className={`h-3.5 w-3.5 ${
              lead.favorite
                ? "fill-amber-400 text-amber-400"
                : "text-(--muted-fg)"
            }`}
          />
        </button>
      );
    case "companyName":
      return (
        <span className="font-medium text-(--fg)">{lead.companyName}</span>
      );
    case "status":
      if (!canWrite) {
        return (
          <span className={`text-[11px] ${statusColor(lead.status)}`}>
            {lead.status}
          </span>
        );
      }
      return (
        <select
          className={`rounded px-1.5 py-0.5 text-[11px] outline-none ${statusColor(lead.status)}`}
          value={lead.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            onPatch({ status: e.target.value as LeadStatus })
          }
        >
          {LEAD_STATUSES.map((s) => (
            <option
              key={s}
              value={s}
              className="bg-(--panel) text-(--fg)"
            >
              {s}
            </option>
          ))}
        </select>
      );
    case "city":
      return <>{lead.cityCanonical ?? lead.city ?? "—"}</>;
    case "province":
      return <>{lead.province ?? "—"}</>;
    case "employees":
      return <>{lead.employees ?? "—"}</>;
    case "email":
      return (
        <span className="truncate text-(--muted-fg)">
          {lead.email ?? "—"}
        </span>
      );
    case "phone":
      return <>{lead.phone ?? "—"}</>;
    case "score":
      return <>{lead.score ?? "—"}</>;
    case "lastActivity":
      return <>{lead.lastActivity ? lead.lastActivity.slice(0, 10) : "—"}</>;
    default:
      return null;
  }
}
