"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
import { leadStatusLabel } from "@/lib/i18n/lead-status-label";

export function BulkActionBar() {
  const t = useTranslations("leads.bulk");
  const tStatus = useTranslations("leadStatus");
  const tAuto = useTranslations("automations");
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
          {t("readOnly", { count: selectedIds.length })}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
          {t("cancel")}
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
      if (!res.ok) throw new Error(data.error || t("massError"));
      for (const lead of data.leads as Lead[]) upsertLead(lead);
      toast.success(t("updated", { count: data.leads.length }));
      toastAutomationBulk(data.automation, {
        dispatched: tAuto("dispatched"),
        dispatchedMany: (count) => tAuto("dispatchedMany", { count }),
      });
      setSelectedIds([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("massError"));
    }
  }

  async function bulkArchive() {
    if (!canWriteLeads) return;
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || t("archiveError"));
        }
        removeLead(id);
      }
      toast.success(t("archived"));
      setSelectedIds([]);
      setConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("archiveError"));
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-(--border) bg-(--muted) px-4 py-2">
        <span className="text-[12px] font-medium">
          {t("selected", { count: selectedIds.length })}
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
          <option value="">{t("changeStatus")}</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {leadStatusLabel(tStatus, s)}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void bulkPatch({ favorite: true })}
        >
          {t("favorite")}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>
          {t("archive")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
          {t("cancel")}
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>{t("archiveTitle")}</DialogTitle>
          <DialogDescription>
            {t("archiveDescription", { count: selectedIds.length })}
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={bulkArchive}>
              {t("archive")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
