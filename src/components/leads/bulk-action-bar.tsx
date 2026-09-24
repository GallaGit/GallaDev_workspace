"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/domain/lead";
import { useSessionAccess } from "@/components/session-access";
import { useUiStore } from "@/store/ui-store";
import { toastAutomationBulk } from "@/components/automations/toast-dispatch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

export function BulkActionBar() {
  const {
    selectedIds,
    setSelectedIds,
    upsertLead,
    removeLead,
  } = useUiStore();
  const { canWriteLeads } = useSessionAccess();
  const [confirm, setConfirm] = useState(false);

  if (selectedIds.length === 0) return null;

  if (!canWriteLeads) {
    return (
      <div className="flex items-center gap-2 border-b border-(--border) bg-(--muted) px-4 py-2">
        <span className="text-[12px] font-medium">
          {selectedIds.length} seleccionados · solo lectura
        </span>
        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
          Cancelar
        </Button>
      </div>
    );
  }

  async function bulkPatch(patch: Partial<Lead>) {
    if (!canWriteLeads) return;
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error masivo");
      for (const lead of data.leads as Lead[]) upsertLead(lead);
      toast.success(`${data.leads.length} leads actualizados`);
      toastAutomationBulk(data.automation);
      setSelectedIds([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  async function bulkArchive() {
    if (!canWriteLeads) return;
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al archivar");
        }
        removeLead(id);
      }
      toast.success("Leads archivados");
      setSelectedIds([]);
      setConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-(--border) bg-(--muted) px-4 py-2">
        <span className="text-[12px] font-medium">
          {selectedIds.length} seleccionados
        </span>
        <select
          className="h-7 rounded border border-(--border) bg-(--bg) px-2 text-[12px]"
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            void bulkPatch({ status: e.target.value as LeadStatus });
            e.target.value = "";
          }}
        >
          <option value="">Cambiar estado…</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void bulkPatch({ favorite: true })}
        >
          Favorito
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>
          Archivar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
          Cancelar
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Archivar selección</DialogTitle>
          <DialogDescription>
            Se archivarán {selectedIds.length} leads en Notion.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={bulkArchive}>
              Archivar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
