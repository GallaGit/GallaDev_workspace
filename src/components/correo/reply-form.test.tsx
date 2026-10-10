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
});
