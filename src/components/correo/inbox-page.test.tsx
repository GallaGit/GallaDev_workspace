import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { InboxPage, type EmailThread } from "./inbox-page";

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast: toastFn };
});

vi.mock("@/components/layout/topbar", () => ({
  Topbar: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function thread(id: string, overrides: Partial<EmailThread> = {}): EmailThread {
  return {
    id,
    subject: `Asunto ${id.slice(0, 1)}`,
    from_address: `${id.slice(0, 1)}@example.com`,
    from_name: id === A ? "Ana" : "Bruno",
    mailbox_address: "hola@galladev.com",
    last_message_at: "2026-10-02T12:00:00.000Z",
    is_read: false,
    message_count: 1,
    lead_id: null,
    created_at: "2026-10-02T12:00:00.000Z",
    archived_at: null,
    trashed_at: null,
    last_snippet: null,
    has_attachments: false,
    ...overrides,
  };
}

type FetchCall = { url: string; method: string; body: unknown };
let calls: FetchCall[] = [];
let patchStatus = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  calls = [];
  patchStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url.startsWith("/api/email/threads/unread-count")) {
        return json({ ok: true, counts: { inbox: 2, archived: 0, trash: 1 } });
      }
      if (url.startsWith("/api/email/threads?") && method === "GET") {
        const sp = new URL(url, "http://x").searchParams;
        const view = sp.get("view");
        if (sp.get("q")) {
          return json({
            ok: true,
            threads: sp.get("q") === "bruno" ? [thread(B, { is_read: true })] : [],
          });
        }
        return json({
          ok: true,
          threads: view === "inbox" ? [thread(A), thread(B, { is_read: true })] : [],
        });
      }
      if (url === "/api/email/threads" && method === "PATCH") {
        return patchStatus === 200
          ? json({ ok: true, updated: (body as { ids: string[] }).ids })
          : json({ ok: false, error: "No se pudieron actualizar los hilos" }, 500);
      }
      if (url.startsWith("/api/email/threads/") && method === "GET") {
        return json({ ok: true, messages: [], attachments: [] });
      }
      if (url.startsWith("/api/email/threads/") && method === "PATCH") {
        return json({ ok: true, thread: {} });
      }
      return json({ ok: true, drafts: [] });
    }),
  );
});

describe("InboxPage (bandeja tipo Gmail)", () => {
  it("pide la vista Recibidos y pinta contadores por vista", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    expect(calls.some((c) => c.url === "/api/email/threads?view=inbox")).toBe(true);
    const views = screen.getByRole("navigation", { name: "Bandejas" });
    await waitFor(() => expect(within(views).getByLabelText("2 sin leer")).toBeTruthy());
    expect(within(views).getByLabelText("1 sin leer")).toBeTruthy();
  });

  it("archiva en bloque los seleccionados y los quita de la lista", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Ana" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Bruno" }));
    expect(screen.getByText("2 seleccionados")).toBeTruthy();

    const toolbar = screen.getByRole("toolbar", { name: "Acciones sobre la selección" });
    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Archivar" }));
    });

    const patch = calls.find((c) => c.method === "PATCH" && c.url === "/api/email/threads");
    expect(patch?.body).toEqual({ ids: [A, B], archived: true });
    await waitFor(() => expect(screen.queryByText("Ana")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("2 hilos archivados");
  });

  it("marca no leído en bloque sin quitar filas", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Bruno");
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Bruno" }));
    const toolbar = screen.getByRole("toolbar", { name: "Acciones sobre la selección" });
    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Marcar como no leído" }));
    });
    expect(
      calls.find((c) => c.method === "PATCH" && c.url === "/api/email/threads")?.body,
    ).toEqual({ ids: [B], is_read: false });
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(2);
    expect(rows[1].getAttribute("data-unread")).toBe("true");
  });

  it("si la API falla, deshace el cambio y avisa", async () => {
    patchStatus = 500;
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Ana" }));
    const toolbar = screen.getByRole("toolbar", { name: "Acciones sobre la selección" });
    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Mover a la papelera" }));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("abrir un hilo no leído lo marca como leído", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByText("Asunto 1"));
    await waitFor(() =>
      expect(
        calls.find((c) => c.method === "PATCH" && c.url === `/api/email/threads/${A}`)?.body,
      ).toEqual({ is_read: true }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0].getAttribute("data-unread")).toBeNull(),
    );
  });

  it("cambia a Papelera y pide esa vista", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: /Papelera/ }));
    await screen.findByText("La papelera está vacía.");
    expect(calls.some((c) => c.url === "/api/email/threads?view=trash")).toBe(true);
    expect(screen.getByText(/30 días/)).toBeTruthy();
  });
});

describe("InboxPage: búsqueda", () => {
  it("busca con debounce en la vista actual y muestra resultados", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    const input = screen.getByRole("searchbox", { name: "Buscar en el correo" });
    fireEvent.change(input, { target: { value: "bru" } });
    fireEvent.change(input, { target: { value: "bruno" } });
    await waitFor(() => expect(screen.queryByText("Ana")).toBeNull());
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByText("1 resultado")).toBeTruthy();
    const searches = calls.filter((c) => c.url.includes("q="));
    expect(searches.map((c) => c.url)).toEqual(["/api/email/threads?view=inbox&q=bruno"]);
  });

  it("todas las bandejas, sin resultados y borrar vuelve a la lista", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("checkbox", { name: "Buscar en todas las bandejas" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el correo" }), {
      target: { value: "zzz" },
    });
    await screen.findByText("No hay hilos que coincidan con «zzz».");
    expect(calls.some((c) => c.url === "/api/email/threads?view=inbox&q=zzz&scope=all")).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    await screen.findByText("Ana");
  });
});
