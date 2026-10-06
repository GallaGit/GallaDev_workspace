"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse } from "@/lib/http/read-json";
import { leadStatusLabel } from "@/lib/i18n/lead-status-label";
import { useUiStore } from "@/store/ui-store";

export function LinkLeadDialog({
  open,
  onOpenChange,
  threadId,
  currentLeadId,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  currentLeadId: string | null;
  onLinked: (leadId: string | null) => void;
}) {
  const t = useTranslations("correo.link");
  const tStatus = useTranslations("leadStatus");
  const leads = useUiStore((s) => s.leads);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    currentLeadId,
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return leads.slice(0, 20);
    const q = search.toLowerCase();
    return leads
      .filter(
        (l) =>
          l.companyName.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [leads, search]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/email/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: selectedLeadId }),
      });
      await readJsonResponse(res, t("error"));
      onLinked(selectedLeadId);
      onOpenChange(false);
      toast.success(selectedLeadId ? t("linked") : t("unlinked"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }, [threadId, selectedLeadId, onLinked, onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Input
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
          autoFocus
        />

        <div className="max-h-56 overflow-y-auto rounded border border-gris-200 dark:border-gris-700">
          {currentLeadId && (
            <button
              type="button"
              onClick={() => setSelectedLeadId(null)}
              className={`w-full border-b border-gris-200 dark:border-gris-700 px-3 py-2 text-left text-[12px] italic hover:bg-gris-50 dark:hover:bg-gris-800 ${
                selectedLeadId === null ? "bg-rojo/5" : ""
              }`}
            >
              {t("remove")}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="p-3 text-[12px] text-gris-500 dark:text-gris-400">
              {t("empty")}
            </p>
          ) : (
            filtered.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelectedLeadId(lead.id)}
                className={`w-full border-b border-gris-200 dark:border-gris-700 px-3 py-2 text-left text-[12px] hover:bg-gris-50 dark:hover:bg-gris-800 ${
                  selectedLeadId === lead.id ? "bg-rojo/5" : ""
                }`}
              >
                <div className="font-medium text-grafito dark:text-gris-100">
                  {lead.companyName}
                </div>
                <div className="text-[10px] text-gris-500 dark:text-gris-400">
                  {lead.email ?? t("noEmail")} ·{" "}
                  {leadStatusLabel(tStatus, lead.status)}
                </div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
