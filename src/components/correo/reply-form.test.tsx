import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { ReplyForm, REPLY_DRAFT_DEBOUNCE_MS } from "./reply-form";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const THREAD = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ReplyForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    cleanup();
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/email/drafts?threadId=")) {
        return json({ ok: true, draft: { id: "d-1", body_text: "texto guardado", reply_mode: "replyAll" } });
      }
      if (url === "/api/email/drafts" && init?.method === "POST") {
        return json({ ok: true, draft: { id: "d-1", body_text: "x" } });
      }
      return json({ ok: true, messageId: "m", missing: [] }, 201);
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("restores the thread draft and its reply-all mode on open", async () => {
    renderWithIntl(<ReplyForm threadId={THREAD} mailbox="ociel@galladev.com" onSent={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue("texto guardado"),
    );
    expect(screen.getByRole("button", { name: /Responder a todos/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Responder como ociel@galladev.com")).toBeInTheDocument();
  });

  it("autosaves the reply draft with threadId after typing", async () => {
    renderWithIntl(<ReplyForm threadId={THREAD} onSent={() => {}} />);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("texto guardado"));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nuevo texto" } });
    await act(async () => {
      vi.advanceTimersByTime(REPLY_DRAFT_DEBOUNCE_MS + 10);
    });
    vi.useRealTimers();
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, i]) => u === "/api/email/drafts" && (i as RequestInit)?.method === "POST",
      );
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body).toMatchObject({ id: "d-1", threadId: THREAD, bodyText: "nuevo texto", replyMode: "replyAll" });
    });
  });

  it("sends reply-all with mode and forwards with recipient", async () => {
    const onSent = vi.fn();
    renderWithIntl(<ReplyForm threadId={THREAD} onSent={onSent} />);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("texto guardado"));
    fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    const reply = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/reply"));
    expect(JSON.parse(String((reply![1] as RequestInit).body))).toEqual({
      text: "texto guardado",
      mode: "replyAll",
    });

    fireEvent.click(screen.getByRole("button", { name: /Reenviar/ }));
    fireEvent.change(screen.getByLabelText("Reenviar a"), { target: { value: "bob@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(2));
    const fwd = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/forward"));
    expect(JSON.parse(String((fwd![1] as RequestInit).body))).toEqual({ to: "bob@example.com", text: "" });
  });

  describe("firma, CC/CCO y adjuntos", () => {
    function withoutDraft(signatures: Record<string, string> | null) {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/email/drafts?threadId=")) return json({ ok: true, draft: null });
        if (url === "/api/email/signatures") {
          return signatures ? json({ ok: true, signatures }) : json({ ok: false }, 500);
        }
        if (url === "/api/email/drafts" && init?.method === "POST") {
          return json({ ok: true, draft: { id: "d-2", body_text: "x" } });
        }
        return json({ ok: true, messageId: "m", missing: [] }, 201);
      });
    }

    it("parte de la firma del buzón cuando no hay borrador y es editable", async () => {
      withoutDraft({ "ociel@galladev.com": "Ociel Galla" });
      renderWithIntl(<ReplyForm threadId={THREAD} mailbox="ociel@galladev.com" onSent={() => {}} />);
      await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("\n\n-- \nOciel Galla"));
    });

    it("no pisa el texto de un borrador restaurado con la firma", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.startsWith("/api/email/drafts?threadId=")) {
          return json({ ok: true, draft: { id: "d-1", body_text: "texto guardado", reply_mode: "reply" } });
        }
        if (url === "/api/email/signatures") {
          return json({ ok: true, signatures: { "hola@galladev.com": "Equipo" } });
        }
        return json({ ok: true });
      });
      renderWithIntl(<ReplyForm threadId={THREAD} onSent={() => {}} />);
      await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("texto guardado"));
      await act(async () => {});
      expect(screen.getByRole("textbox")).toHaveValue("texto guardado");
    });

    it("solo la firma no habilita enviar ni crea borrador", async () => {
      withoutDraft({ "hola@galladev.com": "Equipo" });
      renderWithIntl(<ReplyForm threadId={THREAD} onSent={() => {}} />);
      await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("\n\n-- \nEquipo"));
      expect(screen.getByRole("button", { name: /^Enviar$/ })).toBeDisabled();
      await act(async () => {
        await new Promise((r) => setTimeout(r, REPLY_DRAFT_DEBOUNCE_MS + 100));
      });
      expect(
        fetchMock.mock.calls.some(([u, i]) => u === "/api/email/drafts" && (i as RequestInit)?.method === "POST"),
      ).toBe(false);
    });

    it("envía la respuesta con CC y CCO normalizados", async () => {
      withoutDraft(null);
      const onSent = vi.fn();
      renderWithIntl(<ReplyForm threadId={THREAD} onSent={onSent} />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "CC / CCO" }));
      fireEvent.change(screen.getByLabelText("CC"), { target: { value: "Ana <ANA@example.com>, bob@example.com" } });
      fireEvent.change(screen.getByLabelText("CCO"), { target: { value: "jefe@example.com" } });
      fireEvent.change(screen.getByRole("textbox", { name: /Responder como/ }), { target: { value: "Hola" } });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
      const reply = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/reply"));
      expect(JSON.parse(String((reply![1] as RequestInit).body))).toEqual({
        text: "Hola",
        mode: "reply",
        cc: ["ana@example.com", "bob@example.com"],
        bcc: ["jefe@example.com"],
      });
    });

    it("no envía con una dirección CC no válida", async () => {
      withoutDraft(null);
      renderWithIntl(<ReplyForm threadId={THREAD} onSent={() => {}} />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "CC / CCO" }));
      fireEvent.change(screen.getByLabelText("CC"), { target: { value: "nope" } });
      fireEvent.change(screen.getByRole("textbox", { name: /Responder como/ }), { target: { value: "Hola" } });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      expect(await screen.findByText(/Direcciones no válidas en CC: nope/)).toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/reply"))).toBe(false);
    });

    it("envía adjuntos como multipart en la respuesta", async () => {
      withoutDraft(null);
      const onSent = vi.fn();
      renderWithIntl(<ReplyForm threadId={THREAD} onSent={onSent} />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      fireEvent.change(screen.getByLabelText("Adjuntar archivos"), {
        target: { files: [new File(["hola"], "nota.txt", { type: "text/plain" })] },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /Responder como/ }), { target: { value: "Mira" } });
      fireEvent.click(screen.getByRole("button", { name: /^Enviar$/ }));
      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
      const reply = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/reply"));
      const form = (reply![1] as RequestInit).body as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(JSON.parse(String(form.get("payload")))).toEqual({ text: "Mira", mode: "reply" });
      expect((form.getAll("files") as File[]).map((f) => f.name)).toEqual(["nota.txt"]);
    });
  });
});
