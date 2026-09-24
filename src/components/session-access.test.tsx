import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SessionAccessProvider, useSessionAccess } from "@/components/session-access";
import { LeadFiltersBar } from "@/components/leads/lead-filters";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/leads",
}));

function Probe() {
  const access = useSessionAccess();
  if (!access.ready) return <p>cargando</p>;
  return (
    <p>
      {access.role}:{access.canWriteLeads ? "write" : "read"}:
      {access.isAdmin ? "admin" : "member"}
    </p>
  );
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ id: "u1", email: "v@b.c", role: "Viewer" })),
  );
});

describe("SessionAccessProvider", () => {
  it("marca Viewer como solo lectura", async () => {
    render(
      <SessionAccessProvider>
        <Probe />
      </SessionAccessProvider>,
    );
    expect(await screen.findByText("Viewer:read:member")).toBeInTheDocument();
  });

  it("marca Admin como escritor y administrador", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: "u1", email: "a@b.c", role: "Admin" })),
    );
    render(
      <SessionAccessProvider>
        <Probe />
      </SessionAccessProvider>,
    );
    expect(await screen.findByText("Admin:write:admin")).toBeInTheDocument();
  });
});

describe("LeadFiltersBar", () => {
  it("oculta crear y puntuar cuando el rol es Viewer", async () => {
    render(
      <SessionAccessProvider>
        <Probe />
        <LeadFiltersBar />
      </SessionAccessProvider>,
    );
    expect(await screen.findByText("Viewer:read:member")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar empresa/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /recalcular scores/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /nuevo lead/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra crear y puntuar cuando el rol es Seller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: "u1", email: "s@b.c", role: "Seller" })),
    );
    render(
      <SessionAccessProvider>
        <LeadFiltersBar />
      </SessionAccessProvider>,
    );
    expect(
      await screen.findByRole("button", { name: /recalcular scores/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuevo lead/i })).toBeInTheDocument();
  });
});
