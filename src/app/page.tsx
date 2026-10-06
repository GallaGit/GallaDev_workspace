"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  key: string;
  label: string;
  value: string | number;
  queue?: WorkQueueId;
  href?: string;
};

export default function HomePage() {
  const t = useTranslations();
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
      {
        key: "found",
        label: t("dashboard.kpis.found"),
        value: total,
        href: "/leads",
      },
      {
        key: "pending",
        label: t("dashboard.kpis.pending"),
        value: by("Pendiente revisar") + by("Nuevo"),
        queue: "pendiente_revisar",
      },
      {
        key: "validated",
        label: t("dashboard.kpis.validated"),
        value: by("Validado"),
        href: "/leads",
      },
      {
        key: "emailsPrepared",
        label: t("dashboard.kpis.emailsPrepared"),
        value: by("Email preparado"),
        queue: "emails_listos",
      },
      {
        key: "emailsSent",
        label: t("dashboard.kpis.emailsSent"),
        value: by("Email enviado"),
      },
      {
        key: "replies",
        label: t("dashboard.kpis.replies"),
        value: by("Respondió"),
      },
      {
        key: "meetings",
        label: t("dashboard.kpis.meetings"),
        value: by("Reunión"),
      },
      {
        key: "clients",
        label: t("dashboard.kpis.clients"),
        value: clients,
      },
      {
        key: "conversionRate",
        label: t("dashboard.kpis.conversionRate"),
        value: total ? `${Math.round((clients / total) * 100)}%` : "—",
      },
      {
        key: "missingData",
        label: t("dashboard.kpis.missingData"),
        value: queueCount("faltan_datos"),
        queue: "faltan_datos",
      },
      {
        key: "followupOverdue",
        label: t("dashboard.kpis.followupOverdue"),
        value: queueCount("followup_overdue"),
        queue: "followup_overdue",
      },
    ];
  }, [leads, queueCount, t]);

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
      <Topbar title={t("dashboard.title")} />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 text-sm text-(--muted-fg)">
          {t("dashboard.subtitle")}
        </p>
        {syncState === "syncing" && leads.length === 0 ? (
          <p className="mb-4 text-sm text-(--muted-fg)">
            {t("dashboard.syncing")}
          </p>
        ) : null}
        {!leads.length && syncState === "idle" ? (
          <p className="mb-4 text-sm text-(--muted-fg)">
            {t("dashboard.empty")}
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
                  key={k.key}
                  type="button"
                  onClick={() => openQueue(k.queue!)}
                  className="rounded-lg border border-(--border) bg-(--panel) p-3 text-left transition-colors hover:border-(--accent)"
                >
                  {content}
                </button>
              );
            }
            if (k.key === "validated") {
              return (
                <button
                  key={k.key}
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
                  key={k.key}
                  href={k.href}
                  className="rounded-lg border border-(--border) bg-(--panel) p-3 transition-colors hover:border-(--accent)"
                >
                  {content}
                </Link>
              );
            }
            return (
              <div
                key={k.key}
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
            {t("dashboard.goDailyWork")}
          </Button>
          <Button variant="outline" onClick={() => router.push("/leads")}>
            {t("dashboard.goLeads")}
          </Button>
        </div>
      </div>
    </>
  );
}
