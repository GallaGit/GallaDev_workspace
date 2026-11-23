import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { LeadEmailsSection, type LeadEmailThread } from "./lead-emails-section";

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { toast: toastFn };
});

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const unread: LeadEmailThread = {
  id: T1,
  subject: "Presupuesto asesoría",
  last_message_at: "2026-10-02T12:00:00.000Z",
  last_snippet: "Os paso el detalle",
  is_read: false,
  message_count: 3,
};
const read: LeadEmailThread = {
  id: T2,
  subject: "   ",
  last_message_at: "2026-09-01T08:00:00.000Z",
  last_snippet: null,
  is_read: true,
  message_count: 1,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return json({ ok: true, thread: { id: T1 } });
    return json({ ok: true, threads: [unread, read] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LeadEmailsSection", () => {
  it("pide los hilos del lead y los muestra con asunto, fecha y no leído", async () => {
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink />);

    expect(await screen.findByText("Presupuesto asesoría")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Correos" })).toBeInTheDocument();

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/email/threads?");
    expect(url).toContain(`lead_id=${LEAD_ID}`);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("No leído")).toBeInTheDocument();
    expect(within(items[0]).getByText("3 mensajes")).toBeInTheDocument();
    expect(within(items[0]).getByText("Os paso el detalle")).toBeInTheDocument();
    expect(within(items[0]).getByRole("time")).toHaveAttribute(
      "datetime",
      unread.last_message_at,
    );
    // Hilo leído y sin asunto.
    expect(within(items[1]).queryByText("No leído")).not.toBeInTheDocument();
    expect(within(items[1]).getByText("(sin asunto)")).toBeInTheDocument();
    expect(within(items[1]).getByText("1 mensaje")).toBeInTheDocument();
  });

  it("cada hilo enlaza al hilo en el Correo", async () => {
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink />);
    const link = await screen.findByRole("link", { name: "Presupuesto asesoría" });
    expect(link).toHaveAttribute("href", `/correo?thread=${T1}`);
  });

  it("muestra el estado vacío", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, threads: [] }));
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink />);
    expect(
      await screen.findByText("Ningún hilo de correo vinculado a este lead."),
    ).toBeInTheDocument();
  });

  it("muestra el error de carga sin romper la ficha", async () => {
    fetchMock.mockResolvedValue(json({ ok: false, error: "No autorizado" }, 403));
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los correos",
    );
  });

  it("desvincular envía PATCH lead_id null y quita el hilo de la lista", async () => {
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink />);
    await screen.findByText("Presupuesto asesoría");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "Desvincular el hilo «Presupuesto asesoría»",
        }),
      );
    });

    await waitFor(() =>
      expect(screen.queryByText("Presupuesto asesoría")).not.toBeInTheDocument(),
    );
    const patch = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
    )!;
    expect(patch[0]).toBe(`/api/email/threads/${T1}`);
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({
      lead_id: null,
    });
    expect(toast.success).toHaveBeenCalledWith("Hilo desvinculado del lead");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("si desvincular falla conserva el hilo y avisa", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PATCH"
        ? json({ ok: false, error: "No se pudo actualizar el hilo" }, 500)
        : json({ ok: true, threads: [unread] }),
    );
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink />);
    await screen.findByText("Presupuesto asesoría");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Desvincular el hilo/ }));
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo actualizar el hilo"),
    );
    expect(screen.getByText("Presupuesto asesoría")).toBeInTheDocument();
  });

  it("sin permiso para desvincular no muestra el botón", async () => {
    renderWithIntl(<LeadEmailsSection leadId={LEAD_ID} canUnlink={false} />);
    await screen.findByText("Presupuesto asesoría");
    expect(screen.queryByRole("button", { name: /Desvincular/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Presupuesto asesoría" })).toBeInTheDocument();
  });
});
