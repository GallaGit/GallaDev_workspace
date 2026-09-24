import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useServerInsertedHTML: () => undefined,
}));
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CountRow } from "@/lib/leads/compute-stats";
import { STATS_CHART_STORAGE_KEY } from "@/components/stats/chart-type";
import { StatusDistributionChart } from "@/components/stats/status-distribution-chart";
import { StatsPage } from "@/components/stats/stats-page";
import { useUiStore } from "@/store/ui-store";
import type { Lead, LeadStatus } from "@/lib/domain/lead";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-frame">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-barras">{children}</div>
  ),
  Bar: () => null,
  AreaChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-area">{children}</div>
  ),
  Area: () => null,
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-circular">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

function row(label: string, count: number): CountRow {
  return { key: label, label, count, percent: count };
}

const mixed: CountRow[] = [
  row("Nuevo", 3),
  row("Validado", 2),
  row("Cliente", 0),
];

function lead(id: string, status: LeadStatus): Lead {
  return {
    id,
    url: "",
    companyName: id,
    website: null,
    email: null,
    emailCommercial: null,
    emailManager: null,
    phone: null,
    address: null,
    postalCode: null,
    city: "Valencia",
    cityCanonical: "Valencia",
    province: "Valencia",
    employees: 8,
    linkedin: null,
    services: [],
    status,
    lastActivity: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    discoveredAt: "2026-09-01T00:00:00.000Z",
    notes: null,
    notesOverflow: null,
    emailSubject: null,
    emailBody: null,
    score: null,
    manager: null,
    role: null,
    confidence: null,
    software: null,
    source: "n8n",
    lastContact: null,
    nextFollowUp: null,
    favorite: false,
    aiAnalysis: null,
    lastEditedTime: null,
    archived: false,
    responsibleId: null,
  };
}

describe("StatusDistributionChart", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => memory.get(key) ?? null,
    );
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        memory.set(key, value);
      },
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults to bars and switches among the three types", () => {
    render(<StatusDistributionChart rows={mixed} />);

    expect(screen.getByRole("radio", { name: "Barras" })).toBeChecked();
    expect(screen.getByTestId("chart-barras")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Área" }));
    expect(screen.getByTestId("chart-area")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-barras")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Circular" }));
    expect(screen.getByTestId("chart-circular")).toBeInTheDocument();
    expect(screen.getByText("Validado")).toBeInTheDocument();
  });

  it("does not draw a donut when only one status has leads", () => {
    render(
      <StatusDistributionChart rows={[row("Nuevo", 5), row("Cliente", 0)]} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Circular" }));
    expect(screen.queryByTestId("chart-circular")).not.toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toMatch(/una sola categoría/);
    expect(screen.getByRole("status").textContent).toMatch(/Nuevo/);
  });

  it("shows an empty message instead of a chart when every count is zero", () => {
    render(<StatusDistributionChart rows={[row("Nuevo", 0)]} />);
    expect(screen.getByRole("status").textContent).toMatch(/Sin datos para graficar/);
    expect(screen.queryByTestId("chart-barras")).not.toBeInTheDocument();
  });

  it("persists the choice in localStorage", () => {
    const view = render(<StatusDistributionChart rows={mixed} />);
    fireEvent.click(screen.getByRole("radio", { name: "Área" }));
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STATS_CHART_STORAGE_KEY,
      "area",
    );
    view.unmount();

    render(<StatusDistributionChart rows={mixed} />);
    expect(screen.getByRole("radio", { name: "Área" })).toBeChecked();
    expect(screen.getByTestId("chart-area")).toBeInTheDocument();
  });
});

describe("StatsPage chart selector", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => memory.get(key) ?? null,
    );
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        memory.set(key, value);
      },
    );
    useUiStore.setState({
      leads: [lead("a", "Nuevo"), lead("b", "Validado")],
      lastSyncAt: "2026-09-24T10:00:00.000Z",
      syncState: "idle",
      syncError: null,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        provider: "supabase",
        status: "ok",
        message: "ok",
        latencyMs: 1,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useUiStore.setState({ leads: [], lastSyncAt: null, syncState: "idle" });
  });

  it("keeps funnel rates and breakdowns when the chart type changes", () => {
    render(<StatsPage />);

    expect(screen.getByRole("radiogroup", { name: "Tipo de gráfico" })).toBeInTheDocument();
    expect(screen.getByText("Tasa de validación")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funnel (9 estados)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por provincia" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Circular" }));

    expect(screen.getByTestId("chart-circular")).toBeInTheDocument();
    expect(screen.getByText("Tasa de validación")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Por estado$/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por provincia" })).toBeInTheDocument();
  });
});
