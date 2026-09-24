"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
} from "@/lib/leads/detect-duplicates";
import {
  buildEmptyFieldMerge,
  type MergeFieldPreview,
} from "@/lib/leads/merge-leads";

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

function reasonChip(reason: DuplicateReason) {
  return `${reason.label}${reason.value ? ` · ${reason.value}` : ""}`;
}

function leadLabel(lead: DuplicateLeadRef | Lead | null | undefined) {
  if (!lead) return "Lead";
  return lead.companyName || "Sin nombre";
}

export function DuplicatesPage() {
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads/duplicates")
      .then(async (res) => {
        const body = (await res.json()) as Payload;
        if (!res.ok) {
          throw new Error(body.error || "Error al cargar duplicados");
        }
        if (!cancelled) setData(body);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Error al cargar duplicados",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshGroups = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/duplicates");
      const body = (await res.json()) as Payload;
      if (!res.ok) {
        throw new Error(body.error || "Error al cargar duplicados");
      }
      setData(body);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar duplicados");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadPairDetails = useCallback(async (keepId: string, archiveId: string) => {
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
        throw new Error(keepBody.error || "No se pudo cargar el lead a conservar");
      }
      if (!archiveRes.ok) {
        throw new Error(
          archiveBody.error || "No se pudo cargar el lead a archivar",
        );
      }
      setKeepLead(keepBody.lead as Lead);
      setArchiveLead(archiveBody.lead as Lead);
    } catch (e: unknown) {
      setKeepLead(null);
      setArchiveLead(null);
      setPairError(e instanceof Error ? e.message : "Error al comparar");
    } finally {
      setPairLoading(false);
    }
  }, []);

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
      if (!res.ok) throw new Error(body.error || "Error al fusionar");
      const n = Array.isArray(body.filledKeys) ? body.filledKeys.length : 0;
      toast.success(
        n > 0
          ? `Fusionado: ${n} campo${n === 1 ? "" : "s"} rellenado${n === 1 ? "" : "s"}`
          : "Fusionado: sin campos vacíos que rellenar; origen archivado",
      );
      toastAutomationDispatch(body.automation);
      setConfirm(null);
      clearPair();
      await refreshGroups();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al fusionar");
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
      if (!res.ok) throw new Error(body.error || "Error al archivar");
      toast.success("Lead archivado");
      setConfirm(null);
      clearPair();
      await refreshGroups();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al archivar");
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
      <Topbar title="Duplicados" />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-(--muted-fg)">
            Grupos con el mismo email, teléfono o dominio web (también nombre o
            dirección normalizados; incluye archivados). Elige conservar y
            archivar para comparar; la fusión solo rellena campos vacíos del
            lead conservado.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || refreshing}
            onClick={() => void refreshGroups()}
          >
            {refreshing ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-(--muted-fg)">Detectando duplicados…</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {data && data.groups.length === 0 ? (
          <p className="text-sm text-(--muted-fg)">
            No hay grupos duplicados entre {data.scanned} leads escaneados.
          </p>
        ) : null}

        {data && data.groups.length > 0 ? (
          <>
            <p className="mb-3 text-[12px] text-(--muted-fg)">
              {data.groupCount} grupo{data.groupCount === 1 ? "" : "s"} ·{" "}
              {data.leadCount} leads · {data.scanned} escaneados (con archivados)
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
                                {lead.companyName || "Sin nombre"}
                              </Link>
                              <div className="mt-0.5 text-[12px] text-(--muted-fg)">
                                {[lead.status, lead.city, lead.email, lead.phone]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {lead.archived ? " · Archivado" : ""}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={isKeep ? "default" : "outline"}
                                title="Conservar este lead (destino de la fusión)"
                                onClick={() => selectKeep(group.id, lead.id)}
                              >
                                Conservar
                              </Button>
                              <Button
                                size="sm"
                                variant={isArchive ? "destructive" : "outline"}
                                title="Marcar como origen a archivar / fusionar desde aquí"
                                onClick={() => selectArchive(group.id, lead.id)}
                              >
                                Archivar
                              </Button>
                              <Link
                                href={`/leads?lead=${encodeURIComponent(lead.id)}`}
                                className="px-1 text-[12px] text-(--accent) hover:underline"
                              >
                                Abrir
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
                            Comparar · conservar «
                            {leadLabel(
                              group.leads.find((l) => l.id === keepId),
                            )}
                            » · archivar «
                            {leadLabel(
                              group.leads.find((l) => l.id === archiveId),
                            )}
                            »
                          </h3>
                          <Button size="sm" variant="ghost" onClick={clearPair}>
                            Cerrar
                          </Button>
                        </div>

                        {pairLoading ? (
                          <p className="mt-2 text-[12px] text-(--muted-fg)">
                            Cargando campos…
                          </p>
                        ) : null}
                        {pairError ? (
                          <p className="mt-2 text-[12px] text-red-400">{pairError}</p>
                        ) : null}

                        {activePairReady && mergePreview ? (
                          <>
                            <p className="mt-2 text-[12px] text-(--muted-fg)">
                              {mergePreview.filledKeys.length === 0
                                ? "Ningún campo vacío se rellenaría; el origen solo se archivaría."
                                : `${mergePreview.filledKeys.length} campo${
                                    mergePreview.filledKeys.length === 1
                                      ? ""
                                      : "s"
                                  } vacío${
                                    mergePreview.filledKeys.length === 1
                                      ? ""
                                      : "s"
                                  } se rellenaría${
                                    mergePreview.filledKeys.length === 1
                                      ? ""
                                      : "n"
                                  } (nunca se sobrescribe).`}
                            </p>
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[32rem] border-collapse text-left text-[12px]">
                                <thead>
                                  <tr className="border-b border-(--border) text-(--muted-fg)">
                                    <th className="py-1.5 pr-2 font-medium">
                                      Campo
                                    </th>
                                    <th className="py-1.5 pr-2 font-medium">
                                      Conservar
                                    </th>
                                    <th className="py-1.5 pr-2 font-medium">
                                      Origen
                                    </th>
                                    <th className="py-1.5 font-medium">Acción</th>
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
                                        {row.label}
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
                                            Se rellena
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
                                Fusionar
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
                                Solo archivar origen
                              </Button>
                            </div>
                            ) : (
                              <p className="mt-3 text-[12px] text-(--muted-fg)">
                                Solo lectura: no puedes fusionar ni archivar.
                              </p>
                            )}
                          </>
                        ) : null}
                      </div>
                    ) : isActive && (keepId || archiveId) ? (
                      <p className="mt-3 text-[12px] text-(--muted-fg)">
                        Elige un lead para conservar y otro para archivar /
                        fusionar.
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
              <DialogTitle>Confirmar fusión</DialogTitle>
              <DialogDescription>
                Se conservará «{confirm.keepName}». Se archivará «
                {confirm.archiveName}». Solo se rellenarán campos vacíos del
                conservado
                {confirm.fillCount > 0
                  ? ` (${confirm.fillCount} campo${
                      confirm.fillCount === 1 ? "" : "s"
                    })`
                  : " (ninguno en este caso)"}
                . Nunca se sobrescriben valores existentes.
              </DialogDescription>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Cancelar
                </Button>
                <Button disabled={busy} onClick={() => void runMerge()}>
                  {busy ? "Fusionando…" : "Fusionar"}
                </Button>
              </div>
            </>
          ) : null}
          {confirm?.type === "archive" ? (
            <>
              <DialogTitle>Confirmar archivo</DialogTitle>
              <DialogDescription>
                Se archivará «{confirm.archiveName}» en Notion (no se elimina). No
                se copiarán campos al otro lead.
              </DialogDescription>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void runArchive()}
                >
                  {busy ? "Archivando…" : "Archivar"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
