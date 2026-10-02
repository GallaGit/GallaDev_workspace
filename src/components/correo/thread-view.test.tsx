import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ThreadView } from "./thread-view";
import type { EmailThread } from "./inbox-page";

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { toast: toastFn };
});

const thread: EmailThread = {
  id: "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd",
  subject: "Presupuesto",
  from_address: "ana@example.com",
  from_name: "Ana",
  mailbox_address: "hola@galladev.com",
  last_message_at: "2026-10-02T12:00:00.000Z",
  is_read: true,
  message_count: 1,
  lead_id: null,
  created_at: "2026-10-02T12:00:00.000Z",
};

describe("ThreadView con 500 vacío", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
  });

  it("muestra el error en español y no Unexpected end of JSON input", async () => {
    render(
      <ThreadView
        thread={thread}
        onMarkRead={() => {}}
        onLinkLead={() => {}}
      />,
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    const message = String(vi.mocked(toast.error).mock.calls[0]?.[0]);
    expect(message).toBe(
      "El servidor respondió sin datos (HTTP 500). Inténtalo de nuevo o revisa los registros.",
    );
    expect(message).not.toContain("Unexpected end of JSON input");
  });
});
