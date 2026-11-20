import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSignatures } from "./settings-signatures";
import { renderWithIntl } from "@/test/i18n-wrapper";

const access = vi.hoisted(() => ({ isAdmin: true, ready: true }));

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SettingsSignatures", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    access.isAdmin = true;
    access.ready = true;
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/email/signatures" && !init) {
        return json({
          ok: true,
          signatures: { "hola@galladev.com": "Equipo", "ociel@galladev.com": "" },
        });
      }
      if (url === "/api/email/signatures" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return json({ ok: true, mailbox: body.mailbox, signature: body.signature.trim() });
      }
      return json({ ok: false }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("un no Admin no ve el panel ni pide las firmas", () => {
    access.isAdmin = false;
    renderWithIntl(<SettingsSignatures />);
    expect(screen.queryByText("Firmas de correo")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carga la firma del buzón elegido y guarda los cambios por buzón", async () => {
    renderWithIntl(<SettingsSignatures />);
    const textarea = await screen.findByLabelText("Firma de hola@galladev.com");
    await waitFor(() => expect(textarea).toHaveValue("Equipo"));
    const save = screen.getByRole("button", { name: "Guardar firma" });
    expect(save).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Equipo GallaDev\ngalladev.com" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(screen.getByText("Firma guardada")).toBeInTheDocument());
    const put = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "PUT");
    expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({
      mailbox: "hola@galladev.com",
      signature: "Equipo GallaDev\ngalladev.com",
    });
    expect(screen.getByRole("button", { name: "Guardar firma" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Buzón"), { target: { value: "ociel@galladev.com" } });
    expect(screen.getByLabelText("Firma de ociel@galladev.com")).toHaveValue("");
  });

  it("muestra el error del servidor si no se puede guardar", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? json({ ok: false, error: "La firma es demasiado larga" }, 400)
        : json({ ok: true, signatures: { "hola@galladev.com": "", "ociel@galladev.com": "" } }),
    );
    renderWithIntl(<SettingsSignatures />);
    const textarea = await screen.findByLabelText("Firma de hola@galladev.com");
    fireEvent.change(textarea, { target: { value: "algo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar firma" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La firma es demasiado larga");
  });

  it("avisa si no se pudieron cargar las firmas", async () => {
    fetchMock.mockImplementation(async () => json({ ok: false }, 500));
    renderWithIntl(<SettingsSignatures />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las firmas");
  });
});
