import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { UNREAD_CHANGED_EVENT } from "@/lib/email/thread-state";
import { AppSidebar } from "./app-sidebar";

const access = vi.hoisted(() => ({ isAdmin: true, isVisitor: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/correo",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/session-access", () => ({
  useSessionAccess: () => access,
}));
vi.mock("@/components/layout/nav-chrome", () => ({
  useNavChrome: () => ({ open: false, close: vi.fn(), navId: "nav" }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));
vi.mock("@/components/auth-flash-banner", () => ({ setAuthFlash: vi.fn() }));
vi.mock("@/components/i18n/locale-switcher", () => ({
  LocaleSwitcher: () => null,
}));

let inboxUnread = 4;

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  access.isAdmin = true;
  access.isVisitor = false;
  inboxUnread = 4;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, counts: { inbox: inboxUnread, archived: 1, trash: 0 } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
});

describe("AppSidebar: contador de Correo", () => {
  it("Admin ve los no leídos de Recibidos y se refresca con el aviso", async () => {
    renderWithIntl(<AppSidebar />);
    const badge = await screen.findByTestId("correo-unread-badge");
    expect(badge.textContent).toBe("4");
    expect(badge.getAttribute("aria-label")).toBe("4 sin leer");
    expect(fetch).toHaveBeenCalledWith("/api/email/threads/unread-count");

    inboxUnread = 0;
    await act(async () => {
      window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT));
    });
    await waitFor(() => expect(screen.queryByTestId("correo-unread-badge")).toBeNull());
  });

  it("sin Admin no pide el contador", async () => {
    access.isAdmin = false;
    renderWithIntl(<AppSidebar />);
    await screen.findByText("Correo");
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("correo-unread-badge")).toBeNull();
  });
});
