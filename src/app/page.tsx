"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import {
  buildWorkQueues,
  type WorkQueueId,
} from "@/lib/leads/work-queues";
import { useUiStore } from "@/store/ui-store";

type Kpi = {
  label: string;
  value: string | number;
  queue?: WorkQueueId;
  href?: string;
};

export default function HomePage() {
  useEnsureLeadsSynced();
  const router = useRouter();
  const leads = useUiStore((s) => s.leads);
  const syncState = useUiStore((s) => s.syncState);
  const resetFilters = useUiStore((s) => s.resetFilters);
  const setActiveQueue = useUiStore((s) => s.setActiveQueue);
  const setSelectedLeadId = useUiStore((s) => s.setSelectedLeadId);

  const setFilters = useUiStore((s) => s.setFilters);

  const queues = useMemo(() => buildWorkQueues(leads), [leads]);
  const queueCount = useCallback(
    (id: WorkQueueId) => queues.find((q) => q.id === id)?.count ?? 0,
    [queues],
  );

  const kpis = useMemo((): Kpi[] => {
    const by = (status: string) =>
      leads.filter((l) => l.status === status).length;
    const total = leads.length;
    const clients = by("Cliente");
    return [
      { label: "Leads encontrados", value: total, href: "/leads" },
      {
        label: "Pendientes",
        value: by("Pendiente revisar") + by("Nuevo"),
        queue: "pendiente_revisar",
      },
      {
        label: "Validados",
        value: by("Validado"),
        href: "/leads",
      },
      {
        label: "Emails preparados",
        value: by("Email preparado"),
        queue: "emails_listos",
      },
      { label: "Emails enviados", value: by("Email enviado") },
      { label: "Respuestas", value: by("Respondió") },
      { label: "Reuniones", value: by("Reunión") },
      { label: "Clientes", value: clients },
      {
        label: "Conversion rate",
        value: total ? `${Math.round((clients / total) * 100)}%` : "—",
      },
      {
        label: "Faltan datos",
        value: queueCount("faltan_datos"),
        queue: "faltan_datos",
      },
      {
        label: "Follow-up vencido",
        value: queueCount("followup_overdue"),
        queue: "followup_overdue",
      },
    ];
  }, [leads, queueCount]);

  function openValidated() {
    setActiveQueue(null);
    resetFilters();
    setFilters({ status: ["Validado"] });
    setSelectedLeadId(null);
    router.push("/leads");
  }

  function openQueue(queueId: WorkQueueId) {
    const q = queues.find((x) => x.id === queueId);
    resetFilters();
    setActiveQueue(queueId);
    setSelectedLeadId(q?.firstLeadId ?? null);
    const params = new URLSearchParams({ queue: queueId });
    if (q?.firstLeadId) params.set("lead", q.firstLeadId);
    router.push(`/leads?${params.toString()}`);
  }

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 text-sm text-(--muted-fg)">
          Cualificación de leads · Supabase como fuente de verdad. Las tarjetas
          con cola abren Daily Work filtrado.
        </p>
        {syncState === "syncing" && leads.length === 0 ? (
          <p className="mb-4 text-sm text-(--muted-fg)">Sincronizando…</p>
        ) : null}
        {!leads.length && syncState === "idle" ? (
          <p className="mb-4 text-sm text-(--muted-fg)">
            Sin leads aún. Pulsa Sincronizar o crea uno en Leads.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => {
            const clickable = Boolean(k.queue || k.href);
            const content = (
              <>
                <div className="text-[11px] text-(--muted-fg)">{k.label}</div>
                <div className="mt-1 text-xl font-semibold tracking-tight">
                  {k.value}
                </div>
              </>
            );
            if (k.queue) {
              return (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => openQueue(k.queue!)}
                  className="rounded-lg border border-(--border) bg-(--panel) p-3 text-left transition-colors hover:border-(--accent)"
                >
                  {content}
                </button>
              );
            }
            if (k.label === "Validados") {
              return (
                <button
                  key={k.label}
                  type="button"
                  onClick={openValidated}
                  className="rounded-lg border border-(--border) bg-(--panel) p-3 text-left transition-colors hover:border-(--accent)"
                >
                  {content}
                </button>
              );
            }
            if (k.href) {
              return (
                <Link
                  key={k.label}
                  href={k.href}
                  className="rounded-lg border border-(--border) bg-(--panel) p-3 transition-colors hover:border-(--accent)"
                >
                  {content}
                </Link>
              );
            }
            return (
              <div
                key={k.label}
                className={`rounded-lg border border-(--border) bg-(--panel) p-3 ${
                  clickable ? "" : "opacity-95"
                }`}
              >
                {content}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => router.push("/inbox")}>
            Daily Work
          </Button>
          <Button variant="outline" onClick={() => router.push("/leads")}>
            Ir a Leads
          </Button>
        </div>
      </div>
    </>
  );
}
