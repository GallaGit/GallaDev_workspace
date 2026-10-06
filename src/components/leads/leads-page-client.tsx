"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { LeadFiltersBar } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { BulkActionBar } from "@/components/leads/bulk-action-bar";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import { isWorkQueueId } from "@/lib/leads/work-queues";
import { useUiStore } from "@/store/ui-store";

function buildLeadsUrl(opts: {
  lead?: string | null;
  queue?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.queue) params.set("queue", opts.queue);
  if (opts.lead) params.set("lead", opts.lead);
  const q = params.toString();
  return q ? `/leads?${q}` : "/leads";
}

export function LeadsPageClient() {
  const t = useTranslations("leads");
  const searchParams = useSearchParams();
  const router = useRouter();
  useEnsureLeadsSynced();

  const {
    setSelectedLeadId,
    selectedLeadId,
    leads,
    setActiveQueue,
    activeQueue,
  } = useUiStore();

  useEffect(() => {
    const queueParam = searchParams.get("queue");
    if (isWorkQueueId(queueParam)) {
      setActiveQueue(queueParam);
    } else if (!queueParam) {
      // keep store queue unless URL clears it intentionally via Limpiar
    }
  }, [searchParams, setActiveQueue]);

  useEffect(() => {
    const id = searchParams.get("lead");
    if (id) setSelectedLeadId(id);
  }, [searchParams, setSelectedLeadId]);

  useEffect(() => {
    const queueFromUrl = searchParams.get("queue");
    const queue = isWorkQueueId(queueFromUrl)
      ? queueFromUrl
      : activeQueue;
    const next = buildLeadsUrl({
      lead: selectedLeadId,
      queue,
    });
    const current = buildLeadsUrl({
      lead: searchParams.get("lead"),
      queue: queueFromUrl,
    });
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [selectedLeadId, activeQueue, router, searchParams]);

  return (
    <>
      <Topbar title={t("title")} />
      <LeadFiltersBar />
      <BulkActionBar />
      <div className="flex min-h-0 flex-1">
        <LeadTable />
        <LeadDrawer />
      </div>
      {leads.length === 0 && (
        <div className="pointer-events-none absolute inset-0" aria-hidden />
      )}
    </>
  );
}
