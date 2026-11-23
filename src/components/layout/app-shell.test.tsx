import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const state = vi.hoisted(() => ({
  pathname: "/leads",
  access: {
    ready: true,
    pending: false,
    isAdmin: true,
    canUseCorreo: true,
    isVisitor: false,
  },
  providerProps: [] as { enabled?: boolean; backHref?: string }[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));
vi.mock("@/components/session-access", () => ({
  useSessionAccess: () => state.access,
}));
vi.mock("@/components/layout/app-sidebar", () => ({
  AppSidebar: () => <aside data-testid="app-sidebar">general</aside>,
}));
vi.mock("@/components/correo/correo-sidebar", () => ({
  CorreoSidebar: () => <aside data-testid="correo-sidebar">correo</aside>,
}));
vi.mock("@/components/correo/correo-workspace", () => ({
  CorreoWorkspaceProvider: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    enabled?: boolean;
    backHref?: string;
  }) => {
    state.providerProps.push(props);
    return <div data-testid="correo-provider">{children}</div>;
  },
}));
vi.mock("@/components/auth-flash-banner", () => ({ AuthFlashBanner: () => null }));
vi.mock("@/components/auth/pending-access", () => ({ PendingAccess: () => null }));
vi.mock("@/components/demo/demo-banner", () => ({ DemoBanner: () => null }));

function shell() {
  return <AppShell><p>página</p></AppShell>;
}

beforeEach(() => {
  cleanup();
  state.pathname = "/leads";
  state.access = { ready: true, pending: false, isAdmin: true, canUseCorreo: true, isVisitor: false };
  state.providerProps = [];
});

describe("AppShell: barra de correo en lugar de la general", () => {
  it("fuera de /correo muestra la barra general", () => {
    render(shell());
    expect(screen.getByTestId("app-sidebar")).toBeTruthy();
    expect(screen.queryByTestId("correo-sidebar")).toBeNull();
    expect(screen.queryByTestId("correo-provider")).toBeNull();
  });

  it.each([
    "/correo",
    "/correo/recibidos",
    "/correo/papelera",
    "/correo/borradores",
    "/correo/enviados/11111111-1111-4111-8111-111111111111",
  ])("en %s sustituye la barra general por la de correo", (pathname) => {
    state.pathname = pathname;
    render(shell());
    expect(screen.getByTestId("correo-sidebar")).toBeTruthy();
    expect(screen.queryByTestId("app-sidebar")).toBeNull();
    expect(screen.getByText("página")).toBeTruthy();
  });

  it("/email no es del módulo: conserva la barra general", () => {
    state.pathname = "/email";
    render(shell());
    expect(screen.getByTestId("app-sidebar")).toBeTruthy();
    expect(screen.queryByTestId("correo-sidebar")).toBeNull();
  });

  it("Seller sustituye la barra general por la de correo", () => {
    state.pathname = "/correo/recibidos";
    state.access = { ready: true, pending: false, isAdmin: false, canUseCorreo: true, isVisitor: false };
    render(shell());
    expect(screen.getByTestId("correo-sidebar")).toBeTruthy();
    expect(screen.queryByTestId("app-sidebar")).toBeNull();
    expect(state.providerProps.at(-1)?.enabled).toBe(true);
  });

  it("Viewer conserva la barra general y no pide datos del buzón", () => {
    state.pathname = "/correo/recibidos";
    state.access = { ready: true, pending: false, isAdmin: false, canUseCorreo: false, isVisitor: false };
    render(shell());
    expect(screen.getByTestId("app-sidebar")).toBeTruthy();
    expect(screen.queryByTestId("correo-sidebar")).toBeNull();
  });

  it("el buzón solo se consulta con la sesión de Correo lista", () => {
    state.pathname = "/correo/recibidos";
    state.access = { ready: false, pending: false, isAdmin: false, canUseCorreo: false, isVisitor: false };
    const { rerender } = render(shell());
    expect(screen.getByTestId("correo-sidebar")).toBeTruthy();
    expect(state.providerProps.at(-1)?.enabled).toBe(false);

    state.access = { ready: true, pending: false, isAdmin: false, canUseCorreo: true, isVisitor: false };
    rerender(shell());
    expect(state.providerProps.at(-1)?.enabled).toBe(true);
  });

  it("Atrás vuelve a la última página fuera de /correo (o al dashboard)", () => {
    state.pathname = "/correo/recibidos";
    const direct = render(shell());
    expect(state.providerProps.at(-1)?.backHref).toBe("/");
    direct.unmount();

    state.pathname = "/leads";
    const { rerender } = render(shell());
    state.pathname = "/correo/recibidos";
    rerender(shell());
    expect(state.providerProps.at(-1)?.backHref).toBe("/leads");

    // Moverse dentro de /correo no cambia el destino de Atrás.
    state.pathname = "/correo/papelera";
    rerender(shell());
    expect(state.providerProps.at(-1)?.backHref).toBe("/leads");
  });
});
