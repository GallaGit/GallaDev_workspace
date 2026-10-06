"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lead } from "@/lib/domain/lead";
import { toastAutomationDispatch } from "@/components/automations/toast-dispatch";
import { useSessionAccess } from "@/components/session-access";
import type {
  DuplicateGroup,
  DuplicateLeadRef,
  DuplicateReason,
  DuplicateReasonCode,
} from "@/lib/leads/detect-duplicates";
import {
  buildEmptyFieldMerge,
  type MergeableFieldKey,
  type MergeFieldPreview,
} from "@/lib/leads/merge-leads";
import { leadStatusLabel } from "@/lib/i18n/lead-status-label";

type Payload = {
  groups: DuplicateGroup[];
  groupCount: number;
  leadCount: number;
  scanned: number;
  error?: string;
};

type PairSelection = {
  groupId: string;
  keepId: string;
  archiveId: string;
};

type ConfirmAction =
  | {
      type: "merge";
      keepId: string;
      archiveId: string;
      keepName: string;
      archiveName: string;
      fillCount: number;
    }
  | { type: "archive"; archiveId: string; archiveName: string };

export function DuplicatesPage() {
  const t = useTranslations("duplicates");
  const tStatus = useTranslations("leadStatus");
  const tAuto = useTranslations("automations");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pair, setPair] = useState<PairSelection | null>(null);
  const [keepLead, setKeepLead] = useState<Lead | null>(null);
  const [archiveLead, setArchiveLead] = useState<Lead | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const { canWriteLeads } = useSessionAccess();
  const [busy, setBusy] = useState(false);

  function leadLabel(lead: DuplicateLeadRef | Lead | null | undefined) {
    if (!lead) return t("fallbackLead");
    return lead.companyName || t("unnamed");
  }

  function reasonChip(reason: DuplicateReason) {
    const label = t(`reasons.${reason.code as DuplicateReasonCode}`);
    return `${label}${reason.value ? ` · ${reason.value}` : ""}`;
  }

  function fieldLabel(key: string) {
    return t(`fields.${key as MergeableFieldKey}`);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads/duplicates")
      .then(async (res) => {
        const body = (await res.json()) as Payload;
        if (!res.ok) {
          throw new Error(body.error || t("loadError"));
        }
        if (!cancelled) setData(body);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const refreshGroups = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/duplicates");
      const body = (await res.json()) as Payload;
      if (!res.ok) {
        throw new Error(body.error || t("loadError"));
      }
      setData(body);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  const loadPairDetails = useCallback(
    async (keepId: string, archiveId: string) => {
      setPairLoading(true);
      setPairError(null);
      try {
        const [keepRes, archiveRes] = await Promise.all([
          fetch(`/api/leads/${encodeURIComponent(keepId)}`),
          fetch(`/api/leads/${encodeURIComponent(archiveId)}`),
        ]);
        const keepBody = await keepRes.json();
        const archiveBody = await archiveRes.json();
        if (!keepRes.ok) {
          throw new Error(keepBody.error || t("keepLoadError"));
        }
        if (!archiveRes.ok) {
          throw new Error(archiveBody.error || t("archiveLoadError"));
        }
        setKeepLead(keepBody.lead as Lead);
        setArchiveLead(archiveBody.lead as Lead);
      } catch (e: unknown) {
        setKeepLead(null);
        setArchiveLead(null);
        setPairError(e instanceof Error ? e.message : t("compareError"));
      } finally {
        setPairLoading(false);
      }
    },
    [t],
  );

  const applyPair = useCallback(
    (next: PairSelection | null) => {
      setPair(next);
      if (next?.keepId && next.archiveId) {
        void loadPairDetails(next.keepId, next.archiveId);
      } else {
        setKeepLead(null);
        setArchiveLead(null);
        setPairError(null);
        setPairLoading(false);
      }
    },
    [loadPairDetails],
  );

  const mergePreview = useMemo(() => {
    if (!keepLead || !archiveLead) return null;
    return buildEmptyFieldMerge(keepLead, archiveLead);
  }, [keepLead, archiveLead]);

  const visiblePreview: MergeFieldPreview[] = useMemo(() => {
    if (!mergePreview) return [];
    return mergePreview.preview.filter(
      (row) =>
        row.willFill ||
        (row.keepValue !== "—" && row.archiveValue !== "—") ||
        row.keepValue !== row.archiveValue,
    );
  }, [mergePreview]);

  function selectKeep(groupId: string, leadId: string) {
    const prev = pair?.groupId === groupId ? pair : null;
    const archiveId =
      prev && prev.archiveId !== leadId ? prev.archiveId : "";
    applyPair({ groupId, keepId: leadId, archiveId });
  }

  function selectArchive(groupId: string, leadId: string) {
    const prev = pair?.groupId === groupId ? pair : null;
    const keepId = prev && prev.keepId !== leadId ? prev.keepId : "";
    applyPair({ groupId, keepId, archiveId: leadId });
  }

  function clearPair() {
    applyPair(null);
    setConfirm(null);
  }

  async function runMerge() {
    if (!canWriteLeads) return;
    if (!confirm || confirm.type !== "merge") return;
    setBusy(true);
    try {
      const res = await fetch("/api/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepId: confirm.keepId,
          archiveId: confirm.archiveId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("mergeError"));
      const n = Array.isArray(body.filledKeys) ? body.filledKeys.length : 0;
      toast.success(
        n > 0 ? t("mergeSuccess", { count: n }) : t("mergeEmptySuccess"),
      );
      toastAutomationDispatch(body.automation, {
        dispatched: tAuto("dispatched"),
      });
      setConfirm(null);
      clearPair();
      await refreshGroups();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("mergeError"));
    } finally {
      setBusy(false);
    }
  }

  async function runArchive() {
    if (!canWriteLeads) return;
    if (!confirm || confirm.type !== "archive") return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/leads/${encodeURIComponent(confirm.archiveId)}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("archiveError"));
      toast.success(t("archiveSuccess"));
      setConfirm(null);
      clearPair();
      await refreshGroups();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("archiveError"));
    } finally {
      setBusy(false);
    }
  }

  const activePairReady =
    Boolean(pair?.keepId && pair?.archiveId) &&
    Boolean(keepLead && archiveLead) &&
    !pairLoading;

  return (
    <>
      <Topbar title={t("title")} />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-(--muted-fg)">{t("description")}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || refreshing}
            onClick={() => void refreshGroups()}
          >
            {refreshing ? t("refreshing") : t("refresh")}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-(--muted-fg)">{t("detecting")}</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {data && data.groups.length === 0 ? (
          <p className="text-sm text-(--muted-fg)">
            {t("empty", { count: data.scanned })}
          </p>
        ) : null}

        {data && data.groups.length > 0 ? (
          <>
            <p className="mb-3 text-[12px] text-(--muted-fg)">
              {t("summary", {
                groups: data.groupCount,
                leads: data.leadCount,
                scanned: data.scanned,
              })}
            </p>
            <div className="space-y-3">
              {data.groups.map((group) => {
                const isActive = pair?.groupId === group.id;
                const keepId = isActive ? pair.keepId : "";
                const archiveId = isActive ? pair.archiveId : "";
                return (
                  <section
                    key={group.id}
                    className="rounded-lg border border-(--border) bg-(--panel) p-4"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {group.reasons.map((reason) => (
                        <span
                          key={`${reason.code}:${reason.value}`}
                          className="rounded-md bg-(--muted) px-2 py-0.5 text-[11px] text-(--muted-fg)"
                          title={reason.value}
                        >
                          {reasonChip(reason)}
                        </span>
                      ))}
                    </div>
                    <ul className="mt-3 divide-y divide-(--border)">
                      {group.leads.map((lead) => {
                        const isKeep = keepId === lead.id;
                        const isArchive = archiveId === lead.id;
                        return (
                          <li
                            key={lead.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/leads?lead=${encodeURIComponent(lead.id)}`}
                                className="text-sm font-medium hover:text-(--accent)"
                              >
                                {lead.companyName || t("unnamed")}
                              </Link>
                              <div className="mt-0.5 text-[12px] text-(--muted-fg)">
                                {[
                                  leadStatusLabel(tStatus, lead.status),
                                  lead.city,
                                  lead.email,
                                  lead.phone,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {lead.archived ? ` · ${t("archived")}` : ""}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={isKeep ? "default" : "outline"}
                                title={t("keepHint")}
                                onClick={() => selectKeep(group.id, lead.id)}
                              >
                                {t("keep")}
                              </Button>
                              <Button
                                size="sm"
                                variant={isArchive ? "destructive" : "outline"}
                                title={t("archiveHint")}
                                onClick={() => selectArchive(group.id, lead.id)}
                              >
                                {t("archive")}
                              </Button>
                              <Link
                                href={`/leads?lead=${encodeURIComponent(lead.id)}`}
                                className="px-1 text-[12px] text-(--accent) hover:underline"
                              >
                                {t("open")}
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {isActive && keepId && archiveId ? (
                      <div className="mt-4 rounded-md border border-(--border) bg-(--bg) p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">
                            {t("compare", {
                              keep: leadLabel(
                                group.leads.find((l) => l.id === keepId),
                              ),
                              archive: leadLabel(
                                group.leads.find((l) => l.id === archiveId),
                              ),
                            })}
                          </h3>
                          <Button size="sm" variant="ghost" onClick={clearPair}>
                            {t("close")}
                          </Button>
                        </div>

                        {pairLoading ? (
                          <p className="mt-2 text-[12px] text-(--muted-fg)">
                            {t("loadingFields")}
                          </p>
                        ) : null}
                        {pairError ? (
                          <p className="mt-2 text-[12px] text-red-400">{pairError}</p>
                        ) : null}

                        {activePairReady && mergePreview ? (
                          <>
                            <p className="mt-2 text-[12px] text-(--muted-fg)">
                              {mergePreview.filledKeys.length === 0
                                ? t("noFields")
                                : t("fieldsFilled", {
                                    count: mergePreview.filledKeys.length,
                                  })}
                            </p>
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[32rem] border-collapse text-left text-[12px]">
                                <thead>
                                  <tr className="border-b border-(--border) text-(--muted-fg)">
                                    <th className="py-1.5 pr-2 font-medium">
                                      {t("field")}
                                    </th>
                                    <th className="py-1.5 pr-2 font-medium">
                                      {t("keep")}
                                    </th>
                                    <th className="py-1.5 pr-2 font-medium">
                                      {t("source")}
                                    </th>
                                    <th className="py-1.5 font-medium">{t("action")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visiblePreview.map((row) => (
                                    <tr
                                      key={row.key}
                                      className={
                                        row.willFill
                                          ? "bg-(--muted)/40"
                                          : undefined
                                      }
                                    >
                                      <td className="py-1.5 pr-2 align-top font-medium">
                                        {fieldLabel(row.key)}
                                      </td>
                                      <td className="max-w-[14rem] truncate py-1.5 pr-2 align-top text-(--muted-fg)">
                                        {row.keepValue}
                                      </td>
                                      <td className="max-w-[14rem] truncate py-1.5 pr-2 align-top text-(--muted-fg)">
                                        {row.archiveValue}
                                      </td>
                                      <td className="py-1.5 align-top">
                                        {row.willFill ? (
                                          <span className="text-(--accent)">
                                            {t("willFill")}
                                          </span>
                                        ) : (
                                          <span className="text-(--muted-fg)">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {canWriteLeads ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    type: "merge",
                                    keepId,
                                    archiveId,
                                    keepName: leadLabel(keepLead),
                                    archiveName: leadLabel(archiveLead),
                                    fillCount: mergePreview.filledKeys.length,
                                  })
                                }
                              >
                                {t("merge")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busy || Boolean(archiveLead?.archived)}
                                onClick={() =>
                                  setConfirm({
                                    type: "archive",
                                    archiveId,
                                    archiveName: leadLabel(archiveLead),
                                  })
                                }
                              >
                                {t("archiveSource")}
                              </Button>
                            </div>
                            ) : (
                              <p className="mt-3 text-[12px] text-(--muted-fg)">
                                {t("readOnly")}
                              </p>
                            )}
                          </>
                        ) : null}
                      </div>
                    ) : isActive && (keepId || archiveId) ? (
                      <p className="mt-3 text-[12px] text-(--muted-fg)">
                        {t("choosePair")}
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <DialogContent>
          {confirm?.type === "merge" ? (
            <>
              <DialogTitle>{t("mergeTitle")}</DialogTitle>
              <DialogDescription>
                {t("mergeDescription", {
                  keep: confirm.keepName,
                  archive: confirm.archiveName,
                  fields:
                    confirm.fillCount > 0
                      ? t("fieldCountCase", { count: confirm.fillCount })
                      : t("noFieldsCase"),
                })}
              </DialogDescription>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  {t("cancel")}
                </Button>
                <Button disabled={busy} onClick={() => void runMerge()}>
                  {busy ? t("merging") : t("merge")}
                </Button>
              </div>
            </>
          ) : null}
          {confirm?.type === "archive" ? (
            <>
              <DialogTitle>{t("archiveTitle")}</DialogTitle>
              <DialogDescription>
                {t("archiveDescription", { name: confirm.archiveName })}
              </DialogDescription>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void runArchive()}
                >
                  {busy ? t("archiving") : t("archive")}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
