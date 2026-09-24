import type { CountRow } from "@/lib/leads/compute-stats";

export const STATS_CHART_TYPES = ["barras", "circular", "area"] as const;

export type StatsChartType = (typeof STATS_CHART_TYPES)[number];

export const STATS_CHART_LABELS: Record<StatsChartType, string> = {
  barras: "Barras",
  circular: "Circular",
  area: "Área",
};

export const STATS_CHART_STORAGE_KEY = "gdw-stats-chart-type";

const listeners = new Set<() => void>();

export function isStatsChartType(value: string | null): value is StatsChartType {
  return value === "barras" || value === "circular" || value === "area";
}

export function readStatsChartType(): StatsChartType {
  if (typeof window === "undefined") return "barras";
  try {
    const stored = window.localStorage.getItem(STATS_CHART_STORAGE_KEY);
    return isStatsChartType(stored) ? stored : "barras";
  } catch {
    return "barras";
  }
}

export function writeStatsChartType(type: StatsChartType): void {
  try {
    window.localStorage.setItem(STATS_CHART_STORAGE_KEY, type);
  } catch {
    // Prefer the in-memory choice if storage is blocked.
  }
  for (const listener of listeners) listener();
}

export function subscribeStatsChartType(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type CircularChartState =
  | { kind: "empty" }
  | { kind: "single"; label: string }
  | { kind: "ready"; slices: CountRow[] };

/** A donut of one slice (or none) reads as a full pie and hides the mix. */
export function circularChartState(rows: CountRow[]): CircularChartState {
  const slices = rows.filter((row) => row.count > 0);
  if (slices.length === 0) return { kind: "empty" };
  if (slices.length === 1) return { kind: "single", label: slices[0].label };
  return { kind: "ready", slices };
}

export function hasChartData(rows: CountRow[]): boolean {
  return rows.some((row) => row.count > 0);
}
