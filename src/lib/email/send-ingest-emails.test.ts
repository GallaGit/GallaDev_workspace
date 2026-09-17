import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("./resend-client", () => ({
  getResendClient: vi.fn(() => ({ emails: { send: sendMock } })),
  emailFromClients: () => "GallaDev <hola@galladev.com>",
  emailNotifyTo: () => "notify@example.com",
  emailReplyTo: () => undefined,
}));

import { __emailTemplates, sendIngestEmails } from "./send-ingest-emails";
import { getResendClient } from "./resend-client";

describe("__emailTemplates", () => {
  it("acuse visitante sin claims inventados", () => {
    const text = __emailTemplates.visitorText({
      name: "Ana",
      email: "ana@ejemplo.com",
      company: "Acme",
      message: "Necesito automatizar facturas esta semana.",
    });
    expect(text).toContain("Hola Ana");
    expect(text).toContain("Hemos recibido tu mensaje");
    expect(text.toLowerCase()).not.toContain("garantiz");
    expect(__emailTemplates.visitorSubject()).toContain("recibido");
  });

  it("aviso interno incluye datos básicos", () => {
    const text = __emailTemplates.notifyText({
      name: "Ana",
      email: "ana@ejemplo.com",
      company: "Acme",
      message: "Mensaje de prueba con suficiente longitud.",
      leadId: "abc",
      deduped: false,
    });
    expect(text).toContain("ana@ejemplo.com");
    expect(text).toContain("Acme");
    expect(text).toContain("abc");
  });
});

describe("sendIngestEmails", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    vi.mocked(getResendClient).mockReturnValue({
      emails: { send: sendMock },
    } as never);
  });

  it("envía acuse + aviso interno", async () => {
    const result = await sendIngestEmails({
      name: "Ana",
      email: "ana@ejemplo.com",
      company: "Acme",
      message: "Necesito automatizar facturas esta semana.",
      leadId: "lead-1",
    });
    expect(result.visitorSent).toBe(true);
    expect(result.notifySent).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0].to).toBe("ana@ejemplo.com");
    expect(sendMock.mock.calls[1][0].to).toBe("notify@example.com");
  });

  it("fail-open si Resend falla", async () => {
    sendMock.mockRejectedValue(new Error("network"));
    const result = await sendIngestEmails({
      name: "Ana",
      email: "ana@ejemplo.com",
      company: "",
      message: "Necesito automatizar facturas esta semana.",
    });
    expect(result.visitorSent).toBe(false);
    expect(result.notifySent).toBe(false);
  });
});
