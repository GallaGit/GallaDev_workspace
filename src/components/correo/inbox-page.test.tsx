import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { InboxPage, THREAD_PAGE_SIZE, type EmailThread } from "./inbox-page";

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
let listPage: (params: URLSearchParams) => EmailThread[];

function defaultListPage(params: URLSearchParams): EmailThread[] {
  const view = params.get("view");
  if (params.get("q")) {
    return params.get("q") === "bruno" ? [thread(B, { is_read: true })] : [];
  }
  return view === "inbox" ? [thread(A), thread(B, { is_read: true })] : [];
}

function pageThread(index: number): EmailThread {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  return thread(id, { subject: `Asunto ${index}` });
}

function fullPage(): EmailThread[] {
  return Array.from({ length: THREAD_PAGE_SIZE }, (_, index) =>
    pageThread(index),
  );
}

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
  listPage = defaultListPage;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url.startsWith("/api/email/threads/unread-count")) {
        return json({ ok: true, counts: { inbox: 2, sent: 0, archived: 0, trash: 1 } });
      }
      if (url.startsWith("/api/email/threads?") && method === "GET") {
        const sp = new URL(url, "http://x").searchParams;
        return json({ ok: true, threads: listPage(sp) });
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

  it("abre Enviados, pide esa vista y muestra el vacío", async () => {
    renderWithIntl(<InboxPage />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: /Enviados/ }));
    await screen.findByText("No hay mensajes enviados.");
    expect(calls.some((c) => c.url === "/api/email/threads?view=sent")).toBe(true);
  });

  it("en Enviados archivar no quita el hilo de la lista; la papelera sí", async () => {
    listPage = (params) =>
      params.get("view") === "sent" ? [thread(A), thread(B, { is_read: true })] : [];
    renderWithIntl(<InboxPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Enviados/ }));
    await screen.findByText("Ana");

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Ana" }));
    const toolbar = screen.getByRole("toolbar", { name: "Acciones sobre la selección" });
    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Archivar" }));
    });
    expect(
      calls.find((c) => c.method === "PATCH" && c.url === "/api/email/threads")?.body,
    ).toEqual({ ids: [A], archived: true });
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByText("1 seleccionado")).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Mover a la papelera" }));
    });
    await waitFor(() => expect(screen.queryByText("Ana")).toBeNull());
    expect(screen.getByText("Bruno")).toBeTruthy();
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

describe("InboxPage: paginación", () => {
  it("muestra «Cargar más» cuando la primera página está llena", async () => {
    listPage = (params) => (params.get("offset") ? [] : fullPage());
    renderWithIntl(<InboxPage />);

    await screen.findByText("Asunto 0");
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeTruthy();
  });

  it("añade la segunda página con el offset correcto sin perder la selección", async () => {
    listPage = (params) =>
      params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    renderWithIntl(<InboxPage />);

    await screen.findByText("Asunto 0");
    const firstRow = screen.getAllByRole("option")[0];
    const firstCheckbox = within(firstRow).getByRole("checkbox");
    fireEvent.click(firstCheckbox);
    expect(screen.getByText("1 seleccionado")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);

    expect(
      calls.filter(
        (c) => c.url === `/api/email/threads?view=inbox&offset=${THREAD_PAGE_SIZE}`,
      ),
    ).toHaveLength(1);
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE + 1);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
    expect(screen.getByText("1 seleccionado")).toBeTruthy();
    expect(
      within(screen.getAllByRole("option")[0]).getByRole("checkbox"),
    ).toBeChecked();
  });

  it("no muestra el botón cuando la página es corta", async () => {
    renderWithIntl(<InboxPage />);

    await screen.findByText("Ana");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("cambiar de vista descarta las páginas cargadas", async () => {
    listPage = (params) => {
      if (params.get("view") === "trash") {
        return [thread(B, { subject: "Papelera", trashed_at: "2026-10-01T00:00:00Z" })];
      }
      return params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    };
    renderWithIntl(<InboxPage />);

    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);
    fireEvent.click(screen.getByRole("button", { name: /Papelera/ }));

    await screen.findByText("Papelera");
    expect(screen.queryByText("Asunto 0")).toBeNull();
    expect(screen.queryByText(`Asunto ${THREAD_PAGE_SIZE}`)).toBeNull();
    expect(calls.some((c) => c.url === "/api/email/threads?view=trash")).toBe(true);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("buscar de nuevo reinicia la paginación", async () => {
    listPage = (params) => {
      if (params.get("q")) {
        return params.get("q") === "bruno" ? [thread(B, { is_read: true })] : [];
      }
      return params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    };
    renderWithIntl(<InboxPage />);

    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el correo" }), {
      target: { value: "bruno" },
    });
    await screen.findByText("Bruno");

    expect(screen.queryByText("Asunto 0")).toBeNull();
    expect(screen.queryByText(`Asunto ${THREAD_PAGE_SIZE}`)).toBeNull();
    expect(
      calls.some((c) => c.url === "/api/email/threads?view=inbox&q=bruno"),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("Cargar más en Enviados mantiene view=sent y el offset", async () => {
    listPage = (params) => {
      if (params.get("view") !== "sent") return [];
      return params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    };
    renderWithIntl(<InboxPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Enviados/ }));
    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);
    expect(
      calls.some(
        (c) => c.url === `/api/email/threads?view=sent&offset=${THREAD_PAGE_SIZE}`,
      ),
    ).toBe(true);
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE + 1);
  });
});
