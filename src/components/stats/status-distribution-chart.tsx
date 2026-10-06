"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountRow } from "@/lib/leads/compute-stats";
import { cn } from "@/lib/utils";
import {
  STATS_CHART_TYPES,
  circularChartState,
  hasChartData,
  readStatsChartType,
  subscribeStatsChartType,
  writeStatsChartType,
  type StatsChartType,
} from "@/components/stats/chart-type";

const AXIS_TICK = { fill: "currentColor", fontSize: 11 };

const SLICE_COLOR: Record<string, string> = {
  Nuevo: "#6B7280",
  "Pendiente revisar": "#D97706",
  Validado: "#2563EB",
  "Email preparado": "#7C3AED",
  "Email enviado": "#0284C7",
  Respondió: "#EA580C",
  Reunión: "#DB2777",
  Cliente: "#16A34A",
  Descartado: "#DC2626",
};

function sliceColor(key: string): string {
  return SLICE_COLOR[key] ?? "var(--accent)";
}

type TipEntry = { name?: string; value?: number | string; payload?: { label?: string } };

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
}) {
  const t = useTranslations("stats");
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const name = label || entry.payload?.label || entry.name || "";
  const count =
    typeof entry.value === "number"
      ? entry.value
      : Number(entry.value) || 0;
  return (
    <div className="rounded-md border border-(--border) bg-(--panel) px-2 py-1 text-[12px] text-(--fg) shadow-sm">
      <div>{name}</div>
      <div className="tabular-nums text-(--muted-fg)">
        {t("leadsCount", { count })}
      </div>
    </div>
  );
}

function EmptyChart({ children }: { children: string }) {
  return (
    <p className="px-1 py-10 text-center text-[13px] text-(--muted-fg)" role="status">
      {children}
    </p>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-[320px] w-full text-(--muted-fg)">{children}</div>
  );
}

function BarView({ rows, seriesName }: { rows: CountRow[]; seriesName: string }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
          <YAxis
            type="category"
            dataKey="label"
            width={132}
            tick={AXIS_TICK}
          />
          <Tooltip content={<CountTooltip />} />
          <Bar
            dataKey="count"
            name={seriesName}
            fill="var(--accent)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function AreaView({ rows, seriesName }: { rows: CountRow[]; seriesName: string }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-35}
            textAnchor="end"
            height={78}
            tick={AXIS_TICK}
          />
          <YAxis allowDecimals={false} width={36} tick={AXIS_TICK} />
          <Tooltip content={<CountTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            name={seriesName}
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.22}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function DonutView({
  slices,
  total,
  leadsLabel,
}: {
  slices: CountRow[];
  total: number;
  leadsLabel: string;
}) {
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div className="relative h-[280px] text-(--muted-fg)">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              innerRadius="58%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="var(--panel)"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={sliceColor(slice.key)} />
              ))}
            </Pie>
            <Tooltip content={<CountTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-(--fg)">{total}</span>
          <span className="text-[11px] text-(--muted-fg)">{leadsLabel}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-[12px]">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: sliceColor(slice.key) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-(--fg)">{slice.label}</span>
            <span className="tabular-nums text-(--muted-fg)">{slice.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusDistributionChart({ rows }: { rows: CountRow[] }) {
  const t = useTranslations("stats");
  const chartType = useSyncExternalStore(
    subscribeStatsChartType,
    readStatsChartType,
    () => "barras" as const,
  );
  const setChartType = useCallback((next: StatsChartType) => {
    writeStatsChartType(next);
  }, []);

  const data = hasChartData(rows);
  const circular = circularChartState(rows);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const seriesName = t("leadsCount", { count: total }).replace(/^\d+\s*/, "");

  return (
    <section
      aria-labelledby="stats-chart-heading"
      className="mb-4 rounded-lg border border-(--border) bg-(--panel)"
    >
      <div className="flex flex-col gap-3 border-b border-(--border) px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="stats-chart-heading" className="text-[13px] font-medium tracking-tight">
            {t("chartTitle")}
          </h2>
          <p id="stats-chart-help" className="mt-0.5 max-w-xl text-[11px] text-(--muted-fg)">
            {t("chartHelp")}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label={t("chartType")}
          aria-describedby="stats-chart-help"
          className="flex flex-wrap gap-1"
        >
          {STATS_CHART_TYPES.map((type) => {
            const selected = chartType === type;
            return (
              <label
                key={type}
                className={cn(
                  "relative inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-xs font-medium",
                  "focus-within:ring-2 focus-within:ring-rojo",
                  selected
                    ? "bg-rojo text-blanco"
                    : "bg-gris-100 text-grafito hover:bg-gris-200 dark:bg-gris-800 dark:text-gris-100 dark:hover:bg-gris-700",
                )}
              >
                <input
                  type="radio"
                  name="stats-chart-type"
                  value={type}
                  checked={selected}
                  onChange={() => setChartType(type)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                {t(`chartTypes.${type}`)}
              </label>
            );
          })}
        </div>
      </div>

      <div className="p-3">
        <p className="sr-only">
          {rows.map((row) => `${row.label}: ${row.count}`).join(", ")}
        </p>
        {!data ? (
          <EmptyChart>{t("chartEmpty")}</EmptyChart>
        ) : chartType === "circular" && circular.kind === "single" ? (
          <EmptyChart>
            {t("chartSingle", { label: circular.label })}
          </EmptyChart>
        ) : chartType === "circular" && circular.kind === "ready" ? (
          <DonutView
            slices={circular.slices}
            total={total}
            leadsLabel={seriesName}
          />
        ) : chartType === "area" ? (
          <AreaView rows={rows} seriesName={seriesName} />
        ) : (
          <BarView rows={rows} seriesName={seriesName} />
        )}
      </div>
    </section>
  );
}
