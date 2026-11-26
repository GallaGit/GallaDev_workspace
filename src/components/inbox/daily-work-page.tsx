"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import { useSessionAccess } from "@/components/session-access";
import {
  buildWorkQueues,
  type WorkQueue,
} from "@/lib/leads/work-queues";
import { useUiStore } from "@/store/ui-store";

export function DailyWorkPage() {
  useEnsureLeadsSynced();
  const t = useTranslations("inbox");
  const tQueues = useTranslations("queues");
  const router = useRouter();
  const { canUseCorreo } = useSessionAccess();
  const leads = useUiStore((s) => s.leads);
  const syncState = useUiStore((s) => s.syncState);
  const resetFilters = useUiStore((s) => s.resetFilters);
  const setActiveQueue = useUiStore((s) => s.setActiveQueue);
  const setSelectedLeadId = useUiStore((s) => s.setSelectedLeadId);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  const queues = useMemo(() => buildWorkQueues(leads), [leads]);

  useEffect(() => {
    if (!canUseCorreo) return;
    let cancelled = false;
    fetch("/api/email/drafts")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { drafts?: unknown[] };
        if (!cancelled && Array.isArray(data.drafts)) {
          setDraftCount(data.drafts.length);
        }
      })
      .catch(() => {
        // Sin recuento: el atajo a /correo/borradores sigue disponible.
      });
    return () => {
      cancelled = true;
    };
  }, [canUseCorreo]);

  function openQueue(queue: WorkQueue) {
    resetFilters();
    setActiveQueue(queue.id);
    setSelectedLeadId(queue.firstLeadId);
    const params = new URLSearchParams({ queue: queue.id });
    if (queue.firstLeadId) params.set("lead", queue.firstLeadId);
    router.push(`/leads?${params.toString()}`);
  }

  function openDrafts() {
    router.push("/correo/borradores");
  }

  const draftsCard = canUseCorreo ? (
    <div
      key="emails_listos"
      role="button"
      tabIndex={0}
      onClick={openDrafts}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDrafts();
        }
      }}
      className="cursor-pointer rounded-lg border border-border bg-panel p-4 text-left transition-colors hover:border-accent hover:bg-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t("emailsListos.title")}</h2>
          <p className="mt-0.5 text-[12px] text-muted-fg">
            {t("emailsListos.description")}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
          {draftCount ?? "—"}
        </span>
      </div>
      <p className="mt-3 text-[12px] text-muted-fg">
        {draftCount === 0 ? t("emailsListos.empty") : t("emailsListos.hint")}
      </p>
      <div className="mt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            openDrafts();
          }}
        >
          {t("emailsListos.open")}
        </Button>
      </div>
    </div>
  ) : null;

  const cards: ReactNode[] = [];
  for (const q of queues) {
    cards.push(
      <div
        key={q.id}
        role="button"
        tabIndex={0}
        onClick={() => openQueue(q)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openQueue(q);
          }
        }}
        className="cursor-pointer rounded-lg border border-border bg-panel p-4 text-left transition-colors hover:border-accent hover:bg-muted"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{tQueues(`${q.id}.title`)}</h2>
            <p className="mt-0.5 text-[12px] text-muted-fg">
              {tQueues(`${q.id}.description`)}
            </p>
          </div>
          <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
            {q.count}
          </span>
        </div>
        {q.previewNames.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[12px] text-muted-fg">
            {q.previewNames.map((name) => (
              <li key={name} className="truncate">
                · {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12px] text-muted-fg">{t("empty")}</p>
        )}
        <div className="mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              openQueue(q);
            }}
          >
            {t("openQueue")}
          </Button>
        </div>
      </div>,
    );
    if (q.id === "faltan_datos" && draftsCard) cards.push(draftsCard);
  }

  return (
    <>
      <Topbar title={t("title")} />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 text-sm text-muted-fg">{t("subtitle")}</p>
        {syncState === "syncing" && leads.length === 0 ? (
          <p className="text-sm text-muted-fg">{t("syncing")}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
      </div>
    </>
  );
}
