"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import {
  computeLeadStats,
  type CountRow,
  type FunnelRate,
} from "@/lib/leads/compute-stats";
import { StatusDistributionChart } from "@/components/stats/status-distribution-chart";
import { statusColor, useUiStore } from "@/store/ui-store";
import type { LeadStatus } from "@/lib/domain/lead";
import { LEAD_STATUSES } from "@/lib/domain/lead";
import { leadStatusLabel } from "@/lib/i18n/lead-status-label";

function formatPct(n: number): string {
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;
}

const RATE_MESSAGE_KEYS: Record<string, "validation" | "emailPrepared" | "reply" | "meeting" | "client"> = {
  validation: "validation",
  email_prepared: "emailPrepared",
  response: "reply",
  meeting: "meeting",
  client: "client",
};

const BUCKET_MESSAGE_KEYS: Record<
  string,
  "unknown" | "oneToFour" | "fiveToThirty" | "thirtyOneToFifty" | "fiftyOnePlus" | "zero"
> = {
  unknown: "unknown",
  "1-4": "oneToFour",
  "5-30": "fiveToThirty",
  "31-50": "thirtyOneToFifty",
  "51+": "fiftyOnePlus",
  "0": "zero",
};

function BreakdownTable({
  title,
  rows,
  emptyLabel,
  moreCitiesLabel,
  maxRows,
  statusBadge,
}: {
  title: string;
  rows: CountRow[];
  emptyLabel: string;
  moreCitiesLabel?: (count: number) => string;
  maxRows?: number;
  statusBadge?: boolean;
}) {
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  const hidden = maxRows && rows.length > maxRows ? rows.length - maxRows : 0;

  return (
    <section className="rounded-lg border border-(--border) bg-(--panel)">
      <div className="border-b border-(--border) px-3 py-2">
        <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
      </div>
      {shown.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-(--muted-fg)">
          {emptyLabel}
        </p>
      ) : (
        <div className="divide-y divide-(--border)">
          {shown.map((row) => {
            const isStatus =
              statusBadge &&
              (LEAD_STATUSES as readonly string[]).includes(row.key);
            return (
              <div
                key={row.key}
                className="flex items-center gap-3 px-3 py-1.5 text-[12px]"
              >
                <div className="min-w-0 flex-1 truncate">
                  {isStatus ? (
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${statusColor(row.key as LeadStatus)}`}
                    >
                      {row.label}
                    </span>
                  ) : (
                    <span className="text-(--fg)">{row.label}</span>
                  )}
                </div>
                <div className="w-16 shrink-0">
                  <div className="h-1 overflow-hidden rounded-full bg-(--muted)">
                    <div
                      className="h-full rounded-full bg-(--accent)/70"
                      style={{ width: `${Math.min(row.percent, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-(--fg)">
                  {row.count}
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-(--muted-fg)">
                  {formatPct(row.percent)}
                </span>
              </div>
            );
          })}
          {hidden > 0 && moreCitiesLabel ? (
            <p className="px-3 py-2 text-[11px] text-(--muted-fg)">
              {moreCitiesLabel(hidden)}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function StatsPage() {
  useEnsureLeadsSynced();
  const t = useTranslations("stats");
  const tStatus = useTranslations("leadStatus");
  const tProvince = useTranslations("province");
  const leads = useUiStore((s) => s.leads);
  const syncState = useUiStore((s) => s.syncState);

  const stats = useMemo(() => computeLeadStats(leads), [leads]);

  const localizeStatusRow = (row: CountRow): CountRow => ({
    ...row,
    label: leadStatusLabel(tStatus, row.key),
  });

  const byStatus = stats.byStatus.map(localizeStatusRow);
  const funnel = stats.funnel.map(localizeStatusRow);

  const byProvince = stats.byProvince.map((row) => {
    if (row.key === "Sin provincia") {
      return { ...row, label: t("buckets.noProvince") };
    }
    try {
      return {
        ...row,
        label: tProvince(
          row.key as "Valencia" | "Alicante" | "Castellón" | "Otra",
        ),
      };
    } catch {
      return row;
    }
  });

  const byCity = stats.byCity.map((row) =>
    row.key === "Sin ciudad"
      ? { ...row, label: t("buckets.noCity") }
      : row,
  );

  const byEmployees = stats.byEmployees.map((row) => {
    const key = BUCKET_MESSAGE_KEYS[row.key];
    return key ? { ...row, label: t(`buckets.${key}`) } : row;
  });

  const rates: FunnelRate[] = stats.rates.map((r) => {
    const key = RATE_MESSAGE_KEYS[r.key];
    return key ? { ...r, label: t(`rates.${key}`) } : r;
  });

  return (
    <>
      <Topbar title={t("title")} />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 text-sm text-(--muted-fg)">
          {t("subtitle", { count: stats.total })}
        </p>

        {syncState === "syncing" && leads.length === 0 ? (
          <p className="mb-4 text-sm text-(--muted-fg)">{t("syncing")}</p>
        ) : null}

        {!leads.length && syncState !== "syncing" ? (
          <p className="mb-4 text-sm text-(--muted-fg)">{t("empty")}</p>
        ) : null}

        {/* Rates */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {rates.map((r) => (
            <div
              key={r.key}
              className="rounded-lg border border-(--border) bg-(--panel) p-3"
            >
              <div className="text-[11px] text-(--muted-fg)">{r.label}</div>
              <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                {formatPct(r.percent)}
              </div>
              <div className="mt-0.5 text-[11px] tabular-nums text-(--muted-fg)">
                {r.count} / {stats.total}
              </div>
            </div>
          ))}
        </div>

        <StatusDistributionChart rows={byStatus} />

        {/* Funnel counts */}
        <section className="mb-4 rounded-lg border border-(--border) bg-(--panel)">
          <div className="border-b border-(--border) px-3 py-2">
            <h2 className="text-[13px] font-medium tracking-tight">
              {t("funnelTitle")}
            </h2>
            <p className="mt-0.5 text-[11px] text-(--muted-fg)">
              {t("funnelDescription")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-(--border) sm:grid-cols-5 xl:grid-cols-9">
            {funnel.map((row) => {
              const isStatus = (LEAD_STATUSES as readonly string[]).includes(
                row.key,
              );
              return (
                <div
                  key={row.key}
                  className="bg-(--panel) px-2.5 py-2.5"
                >
                  {isStatus ? (
                    <span
                      className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor(row.key as LeadStatus)}`}
                    >
                      {row.label}
                    </span>
                  ) : (
                    <span className="text-[11px] text-(--muted-fg)">
                      {row.label}
                    </span>
                  )}
                  <div className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight">
                    {row.count}
                  </div>
                  <div className="text-[11px] tabular-nums text-(--muted-fg)">
                    {formatPct(row.percent)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownTable
            title={t("byStatus")}
            rows={byStatus}
            emptyLabel={t("noData")}
            statusBadge
          />
          <BreakdownTable
            title={t("byProvince")}
            rows={byProvince}
            emptyLabel={t("noData")}
          />
          <BreakdownTable
            title={t("byCity")}
            rows={byCity}
            emptyLabel={t("noData")}
            maxRows={20}
            moreCitiesLabel={(count) => t("moreCities", { count })}
          />
          <BreakdownTable
            title={t("bySize")}
            rows={byEmployees}
            emptyLabel={t("noData")}
          />
        </div>
      </div>
    </>
  );
}
