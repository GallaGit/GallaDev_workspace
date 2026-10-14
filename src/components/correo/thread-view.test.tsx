import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithIntl } from "@/test/i18n-wrapper";
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
    renderWithIntl(
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

describe("ThreadView adjuntos (proxy en una sola pestaña)", () => {
  const msg = {
    id: "m1",
    resend_email_id: "r1",
    message_id: null,
    direction: "inbound",
    from_address: "ana@example.com",
    from_name: "Ana",
    to_addresses: ["hola@galladev.com"],
    cc_addresses: [],
    subject: "Presupuesto",
    body_html: null,
    body_text: "Hola",
    send_status: "received",
    received_at: "2026-10-02T12:00:00.000Z",
    created_at: "2026-10-02T12:00:00.000Z",
  };
  const pdf = {
    id: "11111111-1111-4111-8111-111111111111",
    message_id: "m1",
    filename: "factura.pdf",
    content_type: "application/pdf",
    size_bytes: 2048,
  };
  const zip = {
    id: "22222222-2222-4222-8222-222222222222",
    message_id: "m1",
    filename: "fotos.zip",
    content_type: "application/zip",
    size_bytes: 4096,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ok: true, messages: [msg], attachments: [pdf, zip] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
  });

  it("enlaza al proxy de mismo origen sin window.open ni location.assign", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { findByText } = renderWithIntl(
      <ThreadView thread={thread} onMarkRead={() => {}} onLinkLead={() => {}} />,
    );

    const pdfLink = (await findByText("factura.pdf")).closest("a")!;
    expect(pdfLink.getAttribute("href")).toBe(`/api/email/attachments/${pdf.id}/file`);
    expect(pdfLink.getAttribute("target")).toBe("_blank");
    expect(pdfLink.getAttribute("rel")).toContain("noopener");
    expect(pdfLink.hasAttribute("download")).toBe(false);

    const zipLink = (await findByText("fotos.zip")).closest("a")!;
    expect(zipLink.getAttribute("href")).toBe(`/api/email/attachments/${zip.id}/file`);
    expect(zipLink.getAttribute("download")).toBe("fotos.zip");
    expect(zipLink.hasAttribute("target")).toBe(false);

    pdfLink.addEventListener("click", (e) => e.preventDefault());
    pdfLink.click();
    expect(open).not.toHaveBeenCalled();
    // Solo la carga del hilo: el clic no pide URLs firmadas.
    expect(vi.mocked(fetch).mock.calls.every(([u]) => !String(u).includes("/attachments/"))).toBe(true);
    open.mockRestore();
  });
});
