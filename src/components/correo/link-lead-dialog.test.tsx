import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithIntl } from "@/test/i18n-wrapper";
import type { Lead } from "@/lib/domain/lead";
import { useUiStore } from "@/store/ui-store";
import { LinkLeadDialog } from "./link-lead-dialog";

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { toast: toastFn };
});

const THREAD_ID = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";

function createLead(overrides: Partial<Lead>): Lead {
  return {
    id: "lead",
    url: "",
    companyName: "Lead",
    website: null,
    email: null,
    emailCommercial: null,
    emailManager: null,
    phone: null,
    address: null,
    postalCode: null,
    city: null,
    cityCanonical: null,
    province: null,
    employees: null,
    linkedin: null,
    services: [],
    status: "Nuevo",
    lastActivity: null,
    createdAt: null,
    notes: null,
    notesOverflow: null,
    emailSubject: null,
    emailBody: null,
    score: null,
    manager: null,
    role: null,
    confidence: null,
    software: null,
    source: null,
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

const ana = createLead({
  id: "11111111-1111-4111-8111-111111111111",
  companyName: "Gestoría Ana",
  email: "Ana@Gestoria.es",
  status: "Nuevo",
});
const luis = createLead({
  id: "22222222-2222-4222-8222-222222222222",
  companyName: "Asesoría Luis",
  email: "luis@asesoria.com",
  status: "Validado",
});
const sinEmail = createLead({
  id: "33333333-3333-4333-8333-333333333333",
  companyName: "Sin Correo SL",
});

function renderDialog(
  props: Partial<React.ComponentProps<typeof LinkLeadDialog>> = {},
) {
  const onLinked = vi.fn();
  const onOpenChange = vi.fn();
  renderWithIntl(
    <LinkLeadDialog
      open
      onOpenChange={onOpenChange}
      threadId={THREAD_ID}
      currentLeadId={null}
      onLinked={onLinked}
      {...props}
    />,
  );
  return { onLinked, onOpenChange };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  useUiStore.setState({ leads: [ana, luis, sinEmail] });
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, thread: { id: THREAD_ID } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  useUiStore.setState({ leads: [] });
});

describe("LinkLeadDialog", () => {
  it("lista los leads del store con su email o «Sin email»", () => {
    renderDialog();
    expect(screen.getByText("Gestoría Ana")).toBeInTheDocument();
    expect(screen.getByText(/Ana@Gestoria\.es/)).toBeInTheDocument();
    expect(screen.getByText("Asesoría Luis")).toBeInTheDocument();
    expect(screen.getByText(/Sin email/)).toBeInTheDocument();
  });

  it("filtra por empresa o email sin distinguir mayúsculas", () => {
    renderDialog();
    const input = screen.getByPlaceholderText("Buscar por empresa o email…");

    fireEvent.change(input, { target: { value: "ASESORIA.COM" } });
    expect(screen.getByText("Asesoría Luis")).toBeInTheDocument();
    expect(screen.queryByText("Gestoría Ana")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "gestoría" } });
    expect(screen.getByText("Gestoría Ana")).toBeInTheDocument();
    expect(screen.queryByText("Asesoría Luis")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío si nada coincide", () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText("Buscar por empresa o email…"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No se encontraron leads.")).toBeInTheDocument();
  });

  it("vincula el lead elegido por PATCH y avisa al padre", async () => {
    const { onLinked, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByText("Asesoría Luis"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    await waitFor(() => expect(onLinked).toHaveBeenCalledWith(luis.id));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/email/threads/${THREAD_ID}`,
      expect.objectContaining({ method: "PATCH" }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ lead_id: luis.id });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith("Lead vinculado al hilo");
  });

  it("con un lead ya vinculado ofrece «Quitar vinculación» y envía lead_id null", async () => {
    const { onLinked } = renderDialog({ currentLeadId: ana.id });
    fireEvent.click(screen.getByText("Quitar vinculación"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    await waitFor(() => expect(onLinked).toHaveBeenCalledWith(null));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ lead_id: null });
    expect(toast.success).toHaveBeenCalledWith("Vinculación eliminada");
  });

  it("sin vinculación previa no muestra «Quitar vinculación»", () => {
    renderDialog({ currentLeadId: null });
    expect(screen.queryByText("Quitar vinculación")).not.toBeInTheDocument();
  });

  it("si la API falla muestra el error y no avisa al padre ni cierra", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "No se pudo actualizar el hilo" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { onLinked, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByText("Gestoría Ana"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo actualizar el hilo"),
    );
    expect(onLinked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("Cancelar cierra sin llamar a la API", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
