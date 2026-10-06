import type { ReactNode } from "react";
import { cleanup, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsIntegrations } from "./settings-integrations";
import { AutomationsPanel } from "@/components/automations/automations-panel";
import { renderWithIntl } from "@/test/i18n-wrapper";

const access = vi.hoisted(() => ({
  isAdmin: false,
  ready: true,
}));

vi.mock("@/components/session-access", () => ({
  useSessionAccess: () => ({
    role: access.isAdmin ? "Admin" : "Seller",
    ready: access.ready,
    canWriteLeads: true,
    isAdmin: access.isAdmin,
    userId: "u1",
    isVisitor: false,
    pending: false,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
}));

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  access.isAdmin = false;
  access.ready = true;
});

describe("lecturas de ajustes", () => {
  it("un Seller no pide /api/settings ni /api/automations", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(
      <>
        <SettingsIntegrations />
        <AutomationsPanel />
      </>,
    );
    expect(
      await screen.findByText(
        "Solo un administrador puede ver la configuración de integraciones.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Solo un administrador puede ver las automatizaciones."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
