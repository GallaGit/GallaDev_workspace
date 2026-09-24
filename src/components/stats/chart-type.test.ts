import { describe, expect, it } from "vitest";
import type { CountRow } from "@/lib/leads/compute-stats";
import {
  circularChartState,
  hasChartData,
  isStatsChartType,
} from "@/components/stats/chart-type";

function row(label: string, count: number): CountRow {
  return { key: label, label, count, percent: count };
}

describe("stats chart type", () => {
  it("accepts only the three v1 types", () => {
    expect(isStatsChartType("barras")).toBe(true);
    expect(isStatsChartType("circular")).toBe(true);
    expect(isStatsChartType("area")).toBe(true);
    expect(isStatsChartType("radar")).toBe(false);
    expect(isStatsChartType(null)).toBe(false);
  });

  it("treats an empty distribution as no chart data", () => {
    expect(hasChartData([row("Nuevo", 0), row("Cliente", 0)])).toBe(false);
    expect(circularChartState([row("Nuevo", 0)])).toEqual({ kind: "empty" });
  });

  it("refuses a circular chart when only one status has leads", () => {
    expect(circularChartState([row("Nuevo", 4), row("Cliente", 0)])).toEqual({
      kind: "single",
      label: "Nuevo",
    });
  });

  it("keeps slices with leads for a circular chart", () => {
    const state = circularChartState([
      row("Nuevo", 2),
      row("Validado", 0),
      row("Cliente", 1),
    ]);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.slices.map((slice) => slice.label)).toEqual([
        "Nuevo",
        "Cliente",
      ]);
    }
  });
});
