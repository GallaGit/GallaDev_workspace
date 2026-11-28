"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readJsonResponse } from "@/lib/http/read-json";
import type { AuditListResponse } from "@/lib/audit/types";
import { AuditEntryItem } from "./audit-entry-item";

/**
 * Sección «Historial» de la ficha del lead. La API aplica RLS: Seller solo
 * recibe eventos de sus leads; Viewer y Admin, los de cualquier lead.
 */
export function LeadHistorySection({ leadId }: { leadId: string }) {
  const t = useTranslations("audit");
  const [data, setData] = useState<AuditListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/leads/${leadId}/history`);
        const body = await readJsonResponse<AuditListResponse>(res, t("loadError"));
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId, t]);

  return (
    <section data-testid="lead-history-section">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg)">
        {t("title")}
      </h3>
      {loading ? (
        <p className="text-[12px] text-(--muted-fg)">{t("loading")}</p>
      ) : failed || !data ? (
        <p role="alert" className="text-[12px] text-(--muted-fg)">
          {t("loadError")}
        </p>
      ) : data.entries.length === 0 ? (
        <p className="text-[12px] text-(--muted-fg)">{t("empty")}</p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.entries.map((entry) => (
              <AuditEntryItem
                key={entry.id}
                entry={entry}
                viewerId={data.viewerId}
                labels={data.labels}
              />
            ))}
          </ul>
          {data.total > data.entries.length ? (
            <p className="mt-2 text-[11px] text-(--muted-fg)">
              {t("showingLatest", { count: data.entries.length })}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
