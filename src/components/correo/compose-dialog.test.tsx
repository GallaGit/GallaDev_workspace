import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import {
  COMPOSE_AUTOSAVE_DEBOUNCE_MS,
  ComposeDialog,
  type EmailDraft,
} from "./compose-dialog";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), toast) }));

const SIGNATURES = {
  "hola@galladev.com": "Equipo GallaDev",
  "ociel@galladev.com": "Ociel Galla",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function draft(overrides: Partial<EmailDraft> = {}): EmailDraft {
  return {
    id: "d-1",
    mailbox_address: "hola@galladev.com",
    to_address: "",
    cc_address: "",
    bcc_address: "",
    subject: "",
    body_text: "",
    lead_id: null,
    created_at: "2026-11-19T10:00:00Z",
    updated_at: "2026-11-19T10:00:00Z",
    ...overrides,
  };
}

type Call = { url: string; init?: RequestInit };

describe("ComposeDialog", () => {
  let calls: Call[];
  let signatures: Record<string, string> | null;
  let fetchMock: ReturnType<typeof vi.fn>;

  function posts(url: string): Call[] {
    return calls.filter((c) => c.url === url && c.init?.method === "POST");
  }

  function draftBodies(): Record<string, unknown>[] {
    return posts("/api/email/drafts").map((c) => JSON.parse(String(c.init?.body)));
  }

  function renderDialog(
    props: Partial<Parameters<typeof ComposeDialog>[0]> = {},
  ) {
    const onSent = vi.fn();
    const onDraftSaved = vi.fn();
    const onOpenChange = vi.fn();
    renderWithIntl(
      <ComposeDialog
        open
        onOpenChange={onOpenChange}
        defaultMailboxAddress="hola@galladev.com"
        onSent={onSent}
        onDraftSaved={onDraftSaved}
        {...props}
      />,
    );
    return { onSent, onDraftSaved, onOpenChange };
  }

  async function waitForSignature(expected = "Equipo GallaDev") {
    await waitFor(() =>
      expect((screen.getByLabelText("Mensaje") as HTMLTextAreaElement).value).toContain(expected),
    );
  }

  function type(label: string | RegExp, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  beforeEach(() => {
    cleanup();
    calls = [];
    signatures = SIGNATURES;
    toast.success.mockReset();
    toast.error.mockReset();
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "/api/email/signatures") {
        return signatures ? json({ ok: true, signatures }) : json({ ok: false }, 500);
      }
      if (url === "/api/email/drafts" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return json({
          ok: true,
          draft: draft({
            id: "d-1",
            mailbox_address: body.mailbox,
            to_address: body.to,
            cc_address: body.cc,
            bcc_address: body.bcc,
            subject: body.subject,
            body_text: body.bodyText,
          }),
        });
      }
      if (url === "/api/email/compose") {
        return json({ ok: true, threadId: "thread-1" }, 201);
      }
      return json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("CC y CCO", () => {
    it("muestra los campos CC y CCO y envía las direcciones normalizadas", async () => {
      const { onSent } = renderDialog();
      await waitForSignature();

      type("Para", "cliente@example.com");
      type("CC", "Ana <ANA@example.com>, bob@example.com; ana@example.com");
      type("CCO", "jefe@example.com");
      type("Asunto", "Hola");
      fireEvent.change(screen.getByLabelText("Mensaje"), {
        target: { value: "Hola equipo\n\n-- \nEquipo GallaDev" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));

      await waitFor(() => expect(onSent).toHaveBeenCalledWith("thread-1", undefined));
      const send = posts("/api/email/compose")[0];
      expect(send.init?.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(String(send.init?.body))).toMatchObject({
        mailbox: "hola@galladev.com",
        to: "cliente@example.com",
        cc: ["ana@example.com", "bob@example.com"],
        bcc: ["jefe@example.com"],
        subject: "Hola",
      });
    });

    it("sin copias no manda las claves cc/bcc", async () => {
      renderDialog();
      await waitForSignature();
      type("Para", "cliente@example.com");
      fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Hola" } });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(posts("/api/email/compose")).toHaveLength(1));
      const body = JSON.parse(String(posts("/api/email/compose")[0].init?.body));
      expect(body).not.toHaveProperty("cc");
      expect(body).not.toHaveProperty("bcc");
    });

    it("valida las direcciones: muestra el error y no envía", async () => {
      renderDialog();
      await waitForSignature();
      type("Para", "cliente@example.com");
      type("CC", "ana@example.com, esto-no-es-un-correo");
      fireEvent.blur(screen.getByLabelText("CC"));
      expect(
        await screen.findByText(/Direcciones no válidas en CC: esto-no-es-un-correo/),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Hola" } });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(posts("/api/email/compose")).toHaveLength(0);
    });

    it("limita a 20 direcciones por campo", async () => {
      renderDialog();
      await waitForSignature();
      type("Para", "cliente@example.com");
      const many = Array.from({ length: 21 }, (_, i) => `u${i}@example.com`).join(", ");
      type("CCO", many);
      fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Hola" } });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      expect(await screen.findByText(/Máximo 20 direcciones por campo/)).toBeInTheDocument();
      expect(posts("/api/email/compose")).toHaveLength(0);
    });

    it("restaura CC y CCO de un borrador y los guarda al autoguardar", async () => {
      renderDialog({
        initialDraft: draft({
          to_address: "cliente@example.com",
          cc_address: "ana@example.com",
          bcc_address: "jefe@example.com",
          body_text: "Texto",
        }),
      });
      expect(screen.getByLabelText("CC")).toHaveValue("ana@example.com");
      expect(screen.getByLabelText("CCO")).toHaveValue("jefe@example.com");

      vi.useFakeTimers();
      fireEvent.change(screen.getByLabelText("CC"), {
        target: { value: "ana@example.com, bob@example.com" },
      });
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS + 10);
      });
      vi.useRealTimers();
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0]).toMatchObject({
        id: "d-1",
        cc: "ana@example.com, bob@example.com",
        bcc: "jefe@example.com",
      });
    });
  });

  describe("autoguardado", () => {
    it("guarda el borrador ~2 s después de dejar de escribir, no antes", async () => {
      const { onDraftSaved } = renderDialog();
      await waitForSignature();
      vi.useFakeTimers();

      type("Asunto", "Presupuesto");
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS - 200);
      });
      expect(draftBodies()).toHaveLength(0);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      vi.useRealTimers();
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0]).toMatchObject({
        mailbox: "hola@galladev.com",
        subject: "Presupuesto",
      });
      await waitFor(() =>
        expect(onDraftSaved).toHaveBeenCalledWith(
          expect.objectContaining({ id: "d-1" }),
          { auto: true },
        ),
      );
    });

    it("el debounce reinicia con cada pulsación (un solo guardado)", async () => {
      renderDialog();
      await waitForSignature();
      vi.useFakeTimers();
      type("Asunto", "A");
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      type("Asunto", "AB");
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      expect(draftBodies()).toHaveLength(0);
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      vi.useRealTimers();
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0]).toMatchObject({ subject: "AB" });
    });

    it("muestra el indicador «Guardado» tras guardar", async () => {
      renderDialog();
      await waitForSignature();
      const status = screen.getByTestId("compose-autosave-status");
      expect(status).toHaveTextContent("");

      vi.useFakeTimers();
      type("Asunto", "Hola");
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS + 10);
      });
      vi.useRealTimers();
      await waitFor(() => expect(status).toHaveTextContent("Guardado"));
    });

    it("reutiliza el id del borrador en los guardados siguientes (sin duplicar)", async () => {
      renderDialog();
      await waitForSignature();
      vi.useFakeTimers();
      type("Asunto", "Uno");
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS + 10);
      });
      vi.useRealTimers();
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0].id).toBeUndefined();

      vi.useFakeTimers();
      type("Asunto", "Dos");
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS + 10);
      });
      vi.useRealTimers();
      await waitFor(() => expect(draftBodies()).toHaveLength(2));
      expect(draftBodies()[1]).toMatchObject({ id: "d-1", subject: "Dos" });
    });

    it("no guarda nada si solo está la firma o el formulario está vacío", async () => {
      renderDialog();
      await waitForSignature();
      vi.useFakeTimers();
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS * 3);
      });
      // Tocar el cuerpo sin añadir contenido real (firma intacta).
      fireEvent.change(screen.getByLabelText("Mensaje"), {
        target: { value: "\n\n-- \nEquipo GallaDev" },
      });
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS * 3);
      });
      vi.useRealTimers();
      expect(draftBodies()).toHaveLength(0);
    });

    it("un fallo del autoguardado se indica sin toast y no bloquea", async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url === "/api/email/signatures") return json({ ok: true, signatures });
        if (url === "/api/email/drafts") return json({ ok: false, error: "boom" }, 500);
        return json({ ok: true });
      });
      renderDialog();
      await waitForSignature();
      vi.useFakeTimers();
      type("Asunto", "Hola");
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS + 10);
      });
      vi.useRealTimers();
      await waitFor(() =>
        expect(screen.getByTestId("compose-autosave-status")).toHaveTextContent(
          "No se pudo autoguardar",
        ),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("al cerrar el diálogo guarda al momento lo pendiente", async () => {
      const { onOpenChange } = renderDialog();
      await waitForSignature();
      type("Asunto", "Pendiente");
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0]).toMatchObject({ subject: "Pendiente" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("el botón Guardar borrador sigue funcionando y avisa con un toast", async () => {
      const { onDraftSaved } = renderDialog();
      await waitForSignature();
      type("Asunto", "Manual");
      fireEvent.click(screen.getByRole("button", { name: /Guardar borrador/ }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Borrador guardado"));
      expect(onDraftSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: "d-1" }),
        { auto: false },
      );
    });

    it("al enviar no resucita el borrador y pasa su id a onSent", async () => {
      const { onSent } = renderDialog({
        initialDraft: draft({ to_address: "cliente@example.com", body_text: "Hola" }),
      });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(onSent).toHaveBeenCalledWith("thread-1", "d-1"));
      expect(JSON.parse(String(posts("/api/email/compose")[0].init?.body)).draftId).toBe("d-1");
      expect(draftBodies()).toHaveLength(0);
    });
  });

  describe("firma", () => {
    it("añade la firma del buzón al cuerpo de un mensaje nuevo, con espacio para escribir", async () => {
      renderDialog();
      await waitForSignature();
      expect(screen.getByLabelText("Mensaje")).toHaveValue("\n\n-- \nEquipo GallaDev");
      expect(
        screen.getByText(/La firma de hola@galladev.com se añade al final/),
      ).toBeInTheDocument();
    });

    it("la firma se puede editar antes de enviar", async () => {
      renderDialog();
      await waitForSignature();
      type("Para", "cliente@example.com");
      fireEvent.change(screen.getByLabelText("Mensaje"), {
        target: { value: "Hola\n\n-- \nEquipo GallaDev (editada)" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(posts("/api/email/compose")).toHaveLength(1));
      expect(JSON.parse(String(posts("/api/email/compose")[0].init?.body)).text).toBe(
        "Hola\n\n-- \nEquipo GallaDev (editada)",
      );
    });

    it("al cambiar de buzón cambia la firma si no se tocó", async () => {
      renderDialog();
      await waitForSignature();
      fireEvent.change(screen.getByLabelText("De"), {
        target: { value: "ociel@galladev.com" },
      });
      expect(screen.getByLabelText("Mensaje")).toHaveValue("\n\n-- \nOciel Galla");
    });

    it("al cambiar de buzón conserva lo escrito y cambia solo la firma", async () => {
      renderDialog();
      await waitForSignature();
      fireEvent.change(screen.getByLabelText("Mensaje"), {
        target: { value: "Hola Ana\n\n-- \nEquipo GallaDev" },
      });
      fireEvent.change(screen.getByLabelText("De"), {
        target: { value: "ociel@galladev.com" },
      });
      expect(screen.getByLabelText("Mensaje")).toHaveValue("Hola Ana\n\n-- \nOciel Galla");
    });

    it("no añade la firma a un borrador que se reabre", async () => {
      renderDialog({
        initialDraft: draft({ to_address: "a@example.com", body_text: "Texto previo" }),
      });
      await waitFor(() =>
        expect(calls.some((c) => c.url === "/api/email/signatures")).toBe(true),
      );
      await act(async () => {});
      expect(screen.getByLabelText("Mensaje")).toHaveValue("Texto previo");
    });

    it("solo la firma no basta para enviar", async () => {
      renderDialog();
      await waitForSignature();
      type("Para", "cliente@example.com");
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Escribe el cuerpo del mensaje"),
      );
      expect(posts("/api/email/compose")).toHaveLength(0);
    });

    it("sin firma configurada o sin permiso para leerla el cuerpo empieza vacío", async () => {
      signatures = null;
      renderDialog();
      await waitFor(() =>
        expect(calls.some((c) => c.url === "/api/email/signatures")).toBe(true),
      );
      await act(async () => {});
      expect(screen.getByLabelText("Mensaje")).toHaveValue("");
      expect(screen.queryByText(/se añade al final/)).not.toBeInTheDocument();
    });
  });

  describe("adjuntos", () => {
    function pick(...files: File[]) {
      fireEvent.change(screen.getByLabelText("Adjuntar archivos"), {
        target: { files },
      });
    }

    async function fillRequired() {
      await waitForSignature();
      type("Para", "cliente@example.com");
      fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Mira" } });
    }

    it("lista los archivos elegidos y permite quitarlos", async () => {
      renderDialog();
      await waitForSignature();
      pick(new File(["hola"], "nota.txt", { type: "text/plain" }));
      const list = screen.getByRole("list", { name: "Adjuntos" });
      expect(list).toHaveTextContent("nota.txt");

      fireEvent.click(screen.getByRole("button", { name: "Quitar nota.txt" }));
      expect(screen.queryByRole("list", { name: "Adjuntos" })).not.toBeInTheDocument();
    });

    it("envía los archivos como multipart con el payload JSON", async () => {
      const { onSent } = renderDialog();
      await fillRequired();
      type("CC", "ana@example.com");
      pick(
        new File(["hola"], "nota.txt", { type: "text/plain" }),
        new File(["%PDF"], "factura.pdf", { type: "application/pdf" }),
      );
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));

      await waitFor(() => expect(onSent).toHaveBeenCalled());
      const init = posts("/api/email/compose")[0].init!;
      expect(init.headers).toBeUndefined();
      const form = init.body as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(JSON.parse(String(form.get("payload")))).toMatchObject({
        to: "cliente@example.com",
        cc: ["ana@example.com"],
      });
      const files = form.getAll("files") as File[];
      expect(files.map((f) => f.name)).toEqual(["nota.txt", "factura.pdf"]);
    });

    it("rechaza ejecutables, archivos vacíos y demasiado grandes con un aviso", async () => {
      renderDialog();
      await waitForSignature();

      pick(new File(["x"], "virus.exe"));
      expect(toast.error).toHaveBeenLastCalledWith("Tipo de archivo no permitido: virus.exe");

      pick(new File([], "vacio.txt"));
      expect(toast.error).toHaveBeenLastCalledWith("El archivo está vacío: vacio.txt");

      const big = new File(["x"], "grande.zip");
      Object.defineProperty(big, "size", { value: 4 * 1024 * 1024 });
      pick(big);
      expect(toast.error).toHaveBeenLastCalledWith("grande.zip supera 3.0 MB");

      expect(screen.queryByRole("list", { name: "Adjuntos" })).not.toBeInTheDocument();
    });

    it("rechaza superar el total o el número máximo de archivos", async () => {
      renderDialog();
      await waitForSignature();
      const a = new File(["x"], "a.bin");
      Object.defineProperty(a, "size", { value: 2 * 1024 * 1024 });
      const b = new File(["x"], "b.bin");
      Object.defineProperty(b, "size", { value: 2 * 1024 * 1024 });
      pick(a);
      pick(b);
      expect(toast.error).toHaveBeenLastCalledWith("Los adjuntos superan 3.5 MB en total");
      expect(screen.getByRole("list", { name: "Adjuntos" }).children).toHaveLength(1);

      pick(
        ...Array.from({ length: 10 }, (_, i) => new File(["x"], `f${i}.txt`)),
      );
      expect(toast.error).toHaveBeenLastCalledWith("Máximo 10 adjuntos por correo");
    });

    it("los adjuntos no se guardan en el borrador", async () => {
      renderDialog();
      await waitForSignature();
      pick(new File(["hola"], "nota.txt"));
      vi.useFakeTimers();
      type("Asunto", "Con adjunto");
      await act(async () => {
        vi.advanceTimersByTime(COMPOSE_AUTOSAVE_DEBOUNCE_MS + 10);
      });
      vi.useRealTimers();
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(JSON.stringify(draftBodies()[0])).not.toContain("nota.txt");
      expect(screen.getByText(/No se guardan en el borrador/)).toBeInTheDocument();
    });
  });
  describe("variante en línea (área de contenido de /correo)", () => {
    it("se pinta sin modal y con cabecera, campos y acciones", async () => {
      renderDialog({ variant: "inline" });
      await waitForSignature();
      const inline = screen.getByTestId("compose-inline");
      expect(inline.tagName).toBe("SECTION");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("heading", { name: "Nuevo mensaje" })).toBeInTheDocument();
      expect(screen.getByLabelText("CC")).toBeInTheDocument();
      expect(screen.getByLabelText("CCO")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Guardar borrador/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Enviar$/ })).toBeInTheDocument();
    });

    it("no pinta nada si no está abierta", () => {
      renderDialog({ variant: "inline", open: false });
      expect(screen.queryByTestId("compose-inline")).toBeNull();
    });

    it("envía igual que el modal y avisa al padre", async () => {
      const { onSent } = renderDialog({ variant: "inline" });
      await waitForSignature();
      type("Para", "cliente@example.com");
      type("Asunto", "Hola");
      fireEvent.change(screen.getByLabelText("Mensaje"), {
        target: { value: "Hola equipo\n\n-- \nEquipo GallaDev" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(onSent).toHaveBeenCalledWith("thread-1", undefined));
    });

    it("cerrar con la X guarda el borrador si hay contenido", async () => {
      const { onOpenChange } = renderDialog({ variant: "inline" });
      await waitForSignature();
      type("Asunto", "Pendiente");
      fireEvent.click(screen.getByRole("button", { name: "Cerrar redacción" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0]).toMatchObject({ subject: "Pendiente" });
    });

    it("al desmontarse (se abre un hilo) autoguarda lo escrito", async () => {
      const view = renderWithIntl(
        <ComposeDialog
          variant="inline"
          open
          onOpenChange={vi.fn()}
          onSent={vi.fn()}
          onDraftSaved={vi.fn()}
        />,
      );
      await waitForSignature("");
      type("Asunto", "Se queda en borradores");
      view.unmount();
      await waitFor(() => expect(draftBodies()).toHaveLength(1));
      expect(draftBodies()[0]).toMatchObject({ subject: "Se queda en borradores" });
    });

    it("al desmontarse sin cambios no crea borradores vacíos", async () => {
      const view = renderWithIntl(
        <ComposeDialog
          variant="inline"
          open
          onOpenChange={vi.fn()}
          onSent={vi.fn()}
          onDraftSaved={vi.fn()}
        />,
      );
      await waitForSignature("");
      view.unmount();
      await Promise.resolve();
      expect(draftBodies()).toHaveLength(0);
    });
  });
});
