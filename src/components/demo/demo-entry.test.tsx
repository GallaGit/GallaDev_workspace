import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/app/login/login-form";
import { DemoBanner } from "@/components/demo/demo-banner";
import { SessionAccessProvider } from "@/components/session-access";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => ({ get: () => null }),
}));

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  cleanup();
  push.mockReset();
  refresh.mockReset();
});

describe("botón de demo en el login", () => {
  it("muestra Entrar como visitante cuando la demo está configurada", () => {
    render(<LoginForm demoEnabled />);
    expect(
      screen.getByRole("button", { name: "Entrar como visitante" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ver demo sin cuenta/)).toBeInTheDocument();
  });

  it("oculta el botón si la demo está apagada", () => {
    render(<LoginForm demoEnabled={false} />);
    expect(
      screen.queryByRole("button", { name: "Entrar como visitante" }),
    ).not.toBeInTheDocument();
  });
});

describe("banner de demo", () => {
  it("muestra el aviso y el botón de salida para un visitante", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ id: "visitor", email: null, role: null, visitor: true }),
      ),
    );
    render(
      <SessionAccessProvider>
        <DemoBanner />
      </SessionAccessProvider>,
    );
    expect(
      await screen.findByText("Estás viendo una demo con datos ficticios"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salir de la demo" }),
    ).toBeInTheDocument();
  });

  it("no se muestra para un usuario real", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ id: "u1", email: "a@b.c", role: "Seller", visitor: false }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SessionAccessProvider>
        <DemoBanner />
      </SessionAccessProvider>,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("demo-banner")).not.toBeInTheDocument();
  });
});
