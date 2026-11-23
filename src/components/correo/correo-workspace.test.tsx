import { act, cleanup, configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithIntl } from "@/test/i18n-wrapper";
import {
  currentUrl,
  installCorreoRouter,
  routerPush,
  uninstallCorreoRouter,
} from "@/test/correo-route";
import { CorreoContent } from "./correo-content";
import { CorreoSidebar } from "./correo-sidebar";
import { CorreoWorkspaceProvider, THREAD_PAGE_SIZE } from "./correo-workspace";
import { notifyUnreadChanged } from "./use-unread-counts";
import type { EmailThread } from "./types";
import { applyThreadPatch, parseThreadView, threadStaysInView } from "@/lib/email/thread-state";

vi.mock("next/navigation", async () =>
  (await import("@/test/correo-route")).navigationMock,
);

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast: toastFn };
});

vi.mock("@/components/layout/topbar", () => ({
  Topbar: ({
    title,
    menu,
  }: {
    title: string;
    menu?: { open: boolean; onToggle: () => void; openLabel: string; closeLabel: string };
  }) => (
    <header>
      <h1>{title}</h1>
      {menu ? (
        <button type="button" onClick={menu.onToggle} aria-expanded={menu.open}>
          {menu.open ? menu.closeLabel : menu.openLabel}
        </button>
      ) : null}
    </header>
  ),
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
let threadDetail: (id: string) => Response | null;
let draftList: unknown[] = [];
// Lo que ya aplicó el «servidor» (PATCH): las listas siguientes lo reflejan.
let serverPatches: Map<string, Record<string, unknown>>;

function serverThreads(params: URLSearchParams): EmailThread[] {
  const view = parseThreadView(params.get("view"));
  return listPage(params)
    .map((th) => {
      const patch = serverPatches.get(th.id);
      return patch ? applyThreadPatch(th, patch as never, new Date()) : th;
    })
    .filter((th) => params.get("q") || threadStaysInView(th, view));
}

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
  return Array.from({ length: THREAD_PAGE_SIZE }, (_, index) => pageThread(index));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setViewport(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function Module() {
  return (
    <CorreoWorkspaceProvider backHref="/leads">
      <CorreoSidebar />
      <CorreoContent />
    </CorreoWorkspaceProvider>
  );
}

function renderAt(url: string, desktop = true) {
  installCorreoRouter(url);
  setViewport(desktop);
  return renderWithIntl(<Module />);
}

function listUrls(): string[] {
  return calls
    .filter((c) => c.method === "GET" && c.url.startsWith("/api/email/threads?"))
    .map((c) => c.url);
}

// Las páginas de 50 filas tardan en pintarse con la suite en paralelo.
configure({ asyncUtilTimeout: 4000 });

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  calls = [];
  patchStatus = 200;
  listPage = defaultListPage;
  threadDetail = () => null;
  draftList = [];
  serverPatches = new Map();
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
        return json({ ok: true, threads: serverThreads(sp) });
      }
      if (url === "/api/email/threads" && method === "PATCH") {
        const { ids, ...patch } = body as { ids: string[] };
        if (patchStatus === 200) {
          ids.forEach((id) => serverPatches.set(id, { ...serverPatches.get(id), ...patch }));
        }
        return patchStatus === 200
          ? json({ ok: true, updated: (body as { ids: string[] }).ids })
          : json({ ok: false, error: "No se pudieron actualizar los hilos" }, 500);
      }
      if (url.startsWith("/api/email/threads/") && method === "GET") {
        const id = url.split("/").pop() ?? "";
        return threadDetail(id) ?? json({ ok: true, messages: [], attachments: [] });
      }
      if (url.startsWith("/api/email/threads/") && method === "PATCH") {
        return json({ ok: true, thread: {} });
      }
      if (url === "/api/email/drafts") {
        return json({ ok: true, drafts: draftList });
      }
      return json({ ok: true, drafts: [] });
    }),
  );
});

afterEach(() => {
  uninstallCorreoRouter();
  vi.useRealTimers();
});

describe("Correo: bandeja tipo Gmail en la barra de correo", () => {
  it("pide la vista Recibidos y pinta contadores por carpeta", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    expect(listUrls()).toContain("/api/email/threads?view=inbox");
    const views = screen.getByRole("navigation", { name: "Bandejas" });
    await waitFor(() => expect(within(views).getByLabelText("2 sin leer")).toBeTruthy());
    expect(within(views).getByLabelText("1 sin leer")).toBeTruthy();
  });

  it("la barra trae Atrás, Nuevo, las cinco carpetas, Cuentas y la lista", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    const sidebar = document.querySelector("[data-correo-sidebar]") as HTMLElement;
    expect(within(sidebar).getByRole("button", { name: "Atrás" })).toBeTruthy();
    expect(within(sidebar).getByRole("button", { name: "Nuevo" })).toBeTruthy();
    const views = within(sidebar).getByRole("navigation", { name: "Bandejas" });
    expect(
      within(views).getAllByRole("link").map((l) => l.textContent?.replace(/\d+$/, "")),
    ).toEqual(["Recibidos", "Enviados", "Archivados", "Papelera", "Borradores"]);
    const accounts = within(sidebar).getByRole("region", { name: "Cuentas" });
    expect(
      within(accounts).getAllByRole("link").map((l) => l.textContent),
    ).toEqual(["Todas", "hola@", "ociel@"]);
    expect(within(sidebar).getByRole("listbox", { name: "Hilos de correo" })).toBeTruthy();
  });

  it("el área ancha solo muestra el estado vacío, el hilo o la redacción (nunca la lista)", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    const content = screen.getByTestId("correo-content");
    expect(within(content).getByText("Selecciona un hilo para leer los mensajes.")).toBeTruthy();
    expect(within(content).queryByRole("listbox")).toBeNull();
    expect(within(content).queryByRole("navigation")).toBeNull();
  });

  it("Atrás de la barra vuelve a la página anterior", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByTestId("correo-back"));
    expect(routerPush).toHaveBeenCalledWith("/leads");
  });

  it("archiva en bloque los seleccionados y los quita de la lista", async () => {
    renderAt("/correo/recibidos");
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
    renderAt("/correo/recibidos");
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
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Ana" }));
    const toolbar = screen.getByRole("toolbar", { name: "Acciones sobre la selección" });
    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Mover a la papelera" }));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("abrir un hilo no leído pone su ruta, lo muestra en el área ancha y lo marca leído", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByText("Asunto 1"));
    expect(currentUrl()).toBe(`/correo/recibidos/${A}`);
    expect(
      await within(screen.getByTestId("correo-content")).findByRole("heading", {
        name: "Asunto 1",
      }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        calls.find((c) => c.method === "PATCH" && c.url === `/api/email/threads/${A}`)?.body,
      ).toEqual({ is_read: true }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0].getAttribute("data-unread")).toBeNull(),
    );
  });
});

describe("Correo: rutas por carpeta", () => {
  it.each([
    ["/correo/recibidos", "inbox"],
    ["/correo/enviados", "sent"],
    ["/correo/archivados", "archived"],
    ["/correo/papelera", "trash"],
  ])("%s pide la vista %s", async (url, view) => {
    renderAt(url);
    await waitFor(() => expect(listUrls()).toContain(`/api/email/threads?view=${view}`));
    const folders = screen.getByRole("navigation", { name: "Bandejas" });
    expect(within(folders).getByRole("link", { current: "page" })).toHaveAttribute("href", url);
  });

  it("elegir una carpeta navega a su ruta y pide esa vista", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("link", { name: /Papelera/ }));
    expect(currentUrl()).toBe("/correo/papelera");
    await screen.findByText("La papelera está vacía.");
    expect(listUrls()).toContain("/api/email/threads?view=trash");
    expect(screen.getByText(/30 días/)).toBeTruthy();
  });

  it("abre Enviados, pide esa vista y muestra el vacío", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("link", { name: /Enviados/ }));
    await screen.findByText("No hay mensajes enviados.");
    expect(currentUrl()).toBe("/correo/enviados");
    expect(listUrls()).toContain("/api/email/threads?view=sent");
  });

  it("Borradores (/correo/borradores) lista los borradores y abre la redacción en el área ancha", async () => {
    draftList = [
      {
        id: "d1",
        mailbox_address: "hola@galladev.com",
        to_address: "cliente@example.com",
        subject: "Propuesta",
        body_text: "Hola",
        lead_id: null,
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
      },
    ];
    renderAt("/correo/borradores");
    const draft = await screen.findByText("cliente@example.com");
    expect(listUrls()).toEqual([]);
    expect(
      within(screen.getByTestId("correo-content")).getByText(
        "Abre un borrador o pulsa Nuevo para redactar.",
      ),
    ).toBeTruthy();
    fireEvent.click(draft);
    const compose = await screen.findByTestId("compose-inline");
    expect(screen.getByTestId("correo-content")).toContainElement(compose);
    expect(within(compose).getByDisplayValue("Propuesta")).toBeTruthy();
  });

  it("Nuevo abre la redacción en el área ancha, sin modal", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Nuevo" }));
    const compose = await screen.findByTestId("compose-inline");
    expect(screen.getByTestId("correo-content")).toContainElement(compose);
    expect(screen.queryByRole("dialog", { name: /Nuevo mensaje/ })).toBeNull();
  });

  it("en Enviados archivar no quita el hilo de la lista; la papelera sí", async () => {
    listPage = (params) =>
      params.get("view") === "sent" ? [thread(A), thread(B, { is_read: true })] : [];
    renderAt("/correo/enviados");
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

describe("Correo: Cuentas (?cuenta=)", () => {
  it("elegir hola@ filtra con mailbox, se queda en la carpeta y pone ?cuenta=hola", async () => {
    renderAt("/correo/enviados");
    await waitFor(() => expect(listUrls()).toContain("/api/email/threads?view=sent"));
    fireEvent.click(screen.getByRole("link", { name: "hola@" }));
    expect(currentUrl()).toBe("/correo/enviados?cuenta=hola");
    await waitFor(() =>
      expect(listUrls()).toContain(
        "/api/email/threads?view=sent&mailbox=hola%40galladev.com",
      ),
    );
    expect(screen.getByRole("link", { name: "hola@" })).toHaveAttribute("aria-current", "true");
  });

  it("Todas quita el parámetro y vuelve a pedir todos los buzones", async () => {
    renderAt("/correo/recibidos?cuenta=ociel");
    await waitFor(() =>
      expect(listUrls()).toContain("/api/email/threads?view=inbox&mailbox=ociel%40galladev.com"),
    );
    fireEvent.click(screen.getByRole("link", { name: "Todas" }));
    expect(currentUrl()).toBe("/correo/recibidos");
    await waitFor(() => expect(listUrls()).toContain("/api/email/threads?view=inbox"));
  });

  it("un valor desconocido se trata como Todas", async () => {
    renderAt("/correo/recibidos?cuenta=nadie");
    await screen.findByText("Ana");
    expect(listUrls()).toEqual(["/api/email/threads?view=inbox"]);
    expect(screen.getByRole("link", { name: "Todas" })).toHaveAttribute("aria-current", "true");
  });

  it("las carpetas conservan la cuenta en su enlace y al navegar", async () => {
    renderAt("/correo/recibidos?cuenta=hola");
    await screen.findByText("Ana");
    const archived = screen.getByRole("link", { name: /Archivados/ });
    expect(archived).toHaveAttribute("href", "/correo/archivados?cuenta=hola");
    fireEvent.click(archived);
    expect(currentUrl()).toBe("/correo/archivados?cuenta=hola");
  });

  it("cambiar de cuenta no cierra el hilo abierto", async () => {
    renderAt(`/correo/recibidos/${A}`);
    await within(screen.getByTestId("correo-content")).findByRole("heading", {
      name: "Asunto 1",
    });
    fireEvent.click(screen.getByRole("link", { name: "hola@" }));
    expect(currentUrl()).toBe(`/correo/recibidos/${A}?cuenta=hola`);
    expect(
      within(screen.getByTestId("correo-content")).getByRole("heading", { name: "Asunto 1" }),
    ).toBeTruthy();
  });

  it("filtra los borradores por cuenta", async () => {
    const draft = (id: string, mailbox: string) => ({
      id,
      mailbox_address: mailbox,
      to_address: `${id}@example.com`,
      subject: id,
      body_text: "",
      lead_id: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    });
    draftList = [draft("uno", "hola@galladev.com"), draft("dos", "ociel@galladev.com")];
    renderAt("/correo/borradores?cuenta=ociel");
    await screen.findByText("dos@example.com");
    expect(screen.queryByText("uno@example.com")).toBeNull();
  });
});

describe("Correo: abrir un hilo por URL (ficha del lead, enlace compartido)", () => {
  it("un hilo de otra carpeta corrige la ruta a su carpeta y lo deja abierto", async () => {
    const archived = thread(B, {
      subject: "Hilo archivado del lead",
      archived_at: "2026-10-03T10:00:00.000Z",
      lead_id: A,
    });
    listPage = (params) =>
      params.get("view") === "archived" ? [thread(A, { subject: "Otro archivado" })] : [thread(A)];
    threadDetail = (id) =>
      id === B ? json({ ok: true, thread: archived, messages: [], attachments: [] }) : null;

    renderAt(`/correo/recibidos/${B}`);

    expect(
      await within(screen.getByTestId("correo-content")).findByRole("heading", {
        name: "Hilo archivado del lead",
      }),
    ).toBeInTheDocument();
    expect(currentUrl()).toBe(`/correo/archivados/${B}`);
    expect(listUrls()).toContain("/api/email/threads?view=archived");
  });

  it("un hilo inexistente avisa y deja la carpeta sin hilo", async () => {
    listPage = () => [thread(A)];
    threadDetail = (id) =>
      id === B ? json({ ok: false, error: "Hilo no encontrado" }, 404) : null;
    renderAt(`/correo/recibidos/${B}`);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Hilo no encontrado"));
    await screen.findByText("Ana");
    expect(currentUrl()).toBe("/correo/recibidos");
  });
});

describe("Correo: lista que se refresca sola", () => {
  it("al llegar correo nuevo, un aviso refresca la lista sin perder selección ni hilo abierto", async () => {
    renderAt(`/correo/recibidos/${A}`);
    const content = screen.getByTestId("correo-content");
    await within(content).findByRole("heading", { name: "Asunto 1" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar hilo de Bruno" }));
    expect(screen.getByText("1 seleccionado")).toBeTruthy();

    const fresh = thread("33333333-3333-4333-8333-333333333333", {
      from_name: "Carla",
      subject: "Correo nuevo",
      last_message_at: "2026-10-03T08:00:00.000Z",
    });
    listPage = () => [fresh, thread(A), thread(B, { is_read: true })];
    const before = listUrls().length;
    act(() => notifyUnreadChanged());

    await screen.findByText("Carla");
    expect(listUrls().length).toBeGreaterThan(before);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText("1 seleccionado")).toBeTruthy();
    expect(within(content).getByRole("heading", { name: "Asunto 1" })).toBeTruthy();
    expect(currentUrl()).toBe(`/correo/recibidos/${A}`);
  });

  it("el sondeo de 60 s trae el correo nuevo sin recargar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");

    listPage = () => [
      thread("33333333-3333-4333-8333-333333333333", {
        from_name: "Carla",
        last_message_at: "2026-10-03T08:00:00.000Z",
      }),
      thread(A),
      thread(B, { is_read: true }),
    ];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.queryByText("Carla")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await screen.findByText("Carla");
  });

  it("un hilo que salió de la vista desaparece en el refresco", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Bruno");
    listPage = () => [thread(A)];
    act(() => notifyUnreadChanged());
    await waitFor(() => expect(screen.queryByText("Bruno")).toBeNull());
    expect(screen.getByText("Ana")).toBeTruthy();
  });
});

describe("Correo: cajón en móvil", () => {
  function sidebar(): HTMLElement {
    return document.querySelector("[data-correo-sidebar]") as HTMLElement;
  }

  function menuButton(): HTMLElement {
    return within(screen.getByRole("banner")).getByRole("button", { name: /bandeja/ });
  }

  it("está cerrado al entrar, se abre con el botón de menú y no tapa el contenido de forma permanente", async () => {
    renderAt("/correo/recibidos", false);
    await screen.findByText("Ana", {}, { timeout: 3000 }).catch(() => undefined);
    expect(sidebar().className).toContain("-translate-x-full");
    expect(sidebar()).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByTestId("correo-drawer-overlay")).toBeNull();

    fireEvent.click(menuButton());
    expect(sidebar().className).not.toContain("-translate-x-full");
    expect(sidebar()).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("correo-drawer-overlay")).toBeTruthy();
  });

  it("se cierra al tocar un hilo", async () => {
    renderAt("/correo/recibidos", false);
    fireEvent.click(menuButton());
    await screen.findByText("Ana");
    fireEvent.click(screen.getByText("Asunto 1"));
    expect(sidebar().className).toContain("-translate-x-full");
    expect(screen.queryByTestId("correo-drawer-overlay")).toBeNull();
    expect(currentUrl()).toBe(`/correo/recibidos/${A}`);
  });

  it("se cierra con el fondo, con la X y con Escape", async () => {
    renderAt("/correo/recibidos", false);
    const open = () => fireEvent.click(menuButton());

    open();
    fireEvent.click(screen.getByTestId("correo-drawer-overlay"));
    expect(sidebar().className).toContain("-translate-x-full");

    open();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Cerrar bandeja" }));
    expect(sidebar().className).toContain("-translate-x-full");

    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(sidebar().className).toContain("-translate-x-full");
  });

  it("Nuevo cierra el cajón y deja la redacción a pantalla completa", async () => {
    renderAt("/correo/recibidos", false);
    fireEvent.click(menuButton());
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Nuevo" }));
    expect(sidebar().className).toContain("-translate-x-full");
    expect(await screen.findByTestId("compose-inline")).toBeTruthy();
  });

  it("el estado vacío ofrece abrir la bandeja", async () => {
    renderAt("/correo/recibidos", false);
    const content = screen.getByTestId("correo-content");
    fireEvent.click(within(content).getByRole("button", { name: "Abrir bandeja" }));
    expect(sidebar().className).not.toContain("-translate-x-full");
  });

  it("la lista tiene su propio panel con desplazamiento vertical", async () => {
    renderAt("/correo/recibidos", false);
    const panel = screen.getByTestId("correo-list-panel");
    const scroller = panel.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller.className).toContain("min-h-0");
    expect(scroller.className).toContain("min-w-0");
    expect(scroller.className).toContain("flex-1");
    expect(scroller.className).toContain("overflow-x-hidden");
  });
});

describe("Correo: búsqueda", () => {
  it("busca con debounce en la vista actual y muestra resultados", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    const input = screen.getByRole("searchbox", { name: "Buscar en el correo" });
    fireEvent.change(input, { target: { value: "bru" } });
    fireEvent.change(input, { target: { value: "bruno" } });
    await waitFor(() => expect(screen.queryByText("Ana")).toBeNull());
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByText("1 resultado")).toBeTruthy();
    expect(listUrls().filter((u) => u.includes("q="))).toEqual([
      "/api/email/threads?view=inbox&q=bruno",
    ]);
  });

  it("se combina con la cuenta", async () => {
    renderAt("/correo/recibidos?cuenta=hola");
    await screen.findByText("Ana");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el correo" }), {
      target: { value: "bruno" },
    });
    await waitFor(() =>
      expect(listUrls()).toContain(
        "/api/email/threads?view=inbox&q=bruno&mailbox=hola%40galladev.com",
      ),
    );
  });

  it("todas las bandejas, sin resultados y borrar vuelve a la lista", async () => {
    renderAt("/correo/recibidos");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("checkbox", { name: "Buscar en todas las bandejas" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el correo" }), {
      target: { value: "zzz" },
    });
    await screen.findByText("No hay hilos que coincidan con «zzz».");
    expect(listUrls()).toContain("/api/email/threads?view=inbox&q=zzz&scope=all");
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    await screen.findByText("Ana");
  });
});

describe("Correo: paginación", () => {
  it("muestra «Cargar más» cuando la primera página está llena", async () => {
    listPage = (params) => (params.get("offset") ? [] : fullPage());
    renderAt("/correo/recibidos");

    await screen.findByText("Asunto 0");
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeTruthy();
  });

  it("añade la segunda página con el offset correcto sin perder la selección", async () => {
    listPage = (params) =>
      params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    renderAt("/correo/recibidos");

    await screen.findByText("Asunto 0");
    fireEvent.click(within(screen.getAllByRole("option")[0]).getByRole("checkbox"));
    expect(screen.getByText("1 seleccionado")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);

    expect(
      listUrls().filter((u) => u === `/api/email/threads?view=inbox&offset=${THREAD_PAGE_SIZE}`),
    ).toHaveLength(1);
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE + 1);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
    expect(screen.getByText("1 seleccionado")).toBeTruthy();
  });

  it("el refresco automático conserva las páginas ya cargadas", async () => {
    listPage = (params) =>
      params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    renderAt("/correo/recibidos");
    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);

    act(() => notifyUnreadChanged());
    await waitFor(() =>
      expect(listUrls().filter((u) => u === "/api/email/threads?view=inbox").length).toBe(2),
    );
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE + 1);
  });

  it("no muestra el botón cuando la página es corta", async () => {
    renderAt("/correo/recibidos");

    await screen.findByText("Ana");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("cambiar de carpeta descarta las páginas cargadas", async () => {
    listPage = (params) => {
      if (params.get("view") === "trash") {
        return [thread(B, { subject: "Papelera", trashed_at: "2026-10-01T00:00:00Z" })];
      }
      return params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    };
    renderAt("/correo/recibidos");

    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);
    fireEvent.click(screen.getByRole("link", { name: /Papelera/ }));

    await screen.findByText("Papelera", { selector: "p" });
    expect(screen.queryByText("Asunto 0")).toBeNull();
    expect(screen.queryByText(`Asunto ${THREAD_PAGE_SIZE}`)).toBeNull();
    expect(listUrls()).toContain("/api/email/threads?view=trash");
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
    renderAt("/correo/recibidos");

    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el correo" }), {
      target: { value: "bruno" },
    });
    await screen.findByText("Bruno");

    expect(screen.queryByText("Asunto 0")).toBeNull();
    expect(listUrls()).toContain("/api/email/threads?view=inbox&q=bruno");
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("Cargar más en Enviados mantiene view=sent y el offset", async () => {
    listPage = (params) => {
      if (params.get("view") !== "sent") return [];
      return params.get("offset") === String(THREAD_PAGE_SIZE)
        ? [pageThread(THREAD_PAGE_SIZE)]
        : fullPage();
    };
    renderAt("/correo/enviados");
    await screen.findByText("Asunto 0");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText(`Asunto ${THREAD_PAGE_SIZE}`);
    expect(listUrls()).toContain(`/api/email/threads?view=sent&offset=${THREAD_PAGE_SIZE}`);
    expect(screen.getAllByRole("option")).toHaveLength(THREAD_PAGE_SIZE + 1);
  });
});
