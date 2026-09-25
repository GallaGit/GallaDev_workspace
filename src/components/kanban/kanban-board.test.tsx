import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Lead, LeadStatus } from "@/lib/domain/lead";
import { toast } from "sonner";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { useUiStore } from "@/store/ui-store";

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { toast: toastFn };
});

const push = vi.hoisted(() => vi.fn());
const sessionAccess = vi.hoisted(() => ({
  canWriteLeads: true,
  isVisitor: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/session-access", () => ({
  useSessionAccess: () => ({
    role: sessionAccess.canWriteLeads ? "Admin" : "Viewer",
    ready: true,
    canWriteLeads: sessionAccess.canWriteLeads,
    isAdmin: sessionAccess.canWriteLeads,
    isVisitor: sessionAccess.isVisitor,
    userId: "user-1",
  }),
}));

function createLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    url: "https://example.com/lead-1",
    companyName: "Acme Gestoría",
    website: "https://acme.example",
    email: "hola@acme.example",
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
    status: "Nuevo",
    lastActivity: "2026-09-24T10:00:00.000Z",
    createdAt: "2026-09-24T10:00:00.000Z",
    discoveredAt: "2026-09-24T10:00:00.000Z",
    notes: null,
    notesOverflow: null,
    emailSubject: null,
    emailBody: null,
    score: 42,
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
    ...overrides,
  };
}

function columnByStatus(status: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: status, level: 3 });
  const column = heading.parentElement?.parentElement;
  if (!(column instanceof HTMLElement)) {
    throw new Error(`Column not found for ${status}`);
  }
  return column;
}

describe("KanbanBoard", () => {
  const acme = createLead();

  beforeEach(() => {
    sessionAccess.canWriteLeads = true;
    sessionAccess.isVisitor = false;
    vi.mocked(toast).mockClear();
    push.mockReset();
    useUiStore.setState({
      leads: [acme],
      lastSyncAt: "2026-09-24T10:00:00.000Z",
      syncState: "idle",
      syncError: null,
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/db-status")) {
        return Response.json({
          provider: "supabase",
          status: "ok",
          message: "ok",
          latencyMs: 1,
        });
      }
      if (url.includes("/api/leads/") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { status: LeadStatus };
        return Response.json({ lead: { ...acme, status: body.status } });
      }
      return Response.json({ ok: false, error: `unexpected ${url}` }, { status: 500 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useUiStore.setState({ leads: [], lastSyncAt: null, syncState: "idle", syncError: null });
  });

  it("does not render an add-card control", () => {
    render(<KanbanBoard />);

    expect(screen.queryByText(/añadir tarjeta/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/título de la tarjeta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /añadir/i })).not.toBeInTheDocument();
    expect(within(columnByStatus("Nuevo")).getByText("Acme Gestoría")).toBeInTheDocument();
  });

  it("moves an existing card to another column on drop", async () => {
    render(<KanbanBoard />);

    fireEvent.dragStart(screen.getByText("Acme Gestoría"));
    fireEvent.drop(columnByStatus("Validado"), {
      dataTransfer: {
        getData: (type: string) => (type === "text/lead-id" ? "" : ""),
      },
    });

    await waitFor(() => {
      expect(useUiStore.getState().leads.find((lead) => lead.id === "lead-1")?.status).toBe(
        "Validado",
      );
    });
    expect(within(columnByStatus("Nuevo")).getByText("0")).toBeInTheDocument();
    expect(within(columnByStatus("Validado")).getByText("1")).toBeInTheDocument();
    expect(within(columnByStatus("Validado")).getByText("Acme Gestoría")).toBeInTheDocument();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/leads/lead-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Validado" }),
      }),
    );
  });

  it("does not move a card when the session cannot write leads", () => {
    sessionAccess.canWriteLeads = false;
    render(<KanbanBoard />);

    fireEvent.dragStart(screen.getByText("Acme Gestoría"));
    fireEvent.drop(columnByStatus("Validado"), {
      dataTransfer: {
        getData: () => "lead-1",
      },
    });

    expect(useUiStore.getState().leads.find((lead) => lead.id === "lead-1")?.status).toBe(
      "Nuevo",
    );
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      "/api/leads/lead-1",
      expect.anything(),
    );
  });

  it("avisa en español y no guarda si el visitante suelta una tarjeta", () => {
    sessionAccess.canWriteLeads = false;
    sessionAccess.isVisitor = true;
    render(<KanbanBoard />);

    fireEvent.dragStart(screen.getByText("Acme Gestoría"));
    fireEvent.drop(columnByStatus("Validado"), {
      dataTransfer: {
        getData: () => "lead-1",
      },
    });

    expect(toast).toHaveBeenCalledWith("En la demo los cambios no se guardan", {
      description: "Los datos son ficticios y de solo lectura.",
    });
    expect(useUiStore.getState().leads.find((lead) => lead.id === "lead-1")?.status).toBe(
      "Nuevo",
    );
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      "/api/leads/lead-1",
      expect.anything(),
    );
  });
});
