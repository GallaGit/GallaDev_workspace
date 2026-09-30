import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();

vi.mock("resend", () => ({
  Resend: function Resend() {
    return {
      webhooks: {
        verify: verifyMock,
      },
    };
  },
}));

import { verifyInboundWebhook, __resetResendInstanceForTests } from "./inbound-verify";

const VALID_HEADERS = {
  "svix-id": "msg_123",
  "svix-timestamp": "1696000000",
  "svix-signature": "v1,valid",
};

const SECRET = "whsec_test_secret";

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: "email.received",
    data: {
      email_id: "em_abc123",
      message_id: "<abc@mail.example.com>",
      from: "Test User <test@example.com>",
      to: ["hola@galladev.com"],
      subject: "Hola GallaDev",
      ...overrides,
    },
  };
}

describe("verifyInboundWebhook", () => {
  beforeAll(() => {
    __resetResendInstanceForTests();
  });

  beforeEach(() => {
    verifyMock.mockReset();
    verifyMock.mockImplementation(({ payload }: { payload: string }) =>
      JSON.parse(payload),
    );
  });

  it("returns ok for a valid email.received to hola@galladev.com", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.data.email_id).toBe("em_abc123");
      expect(result.event.data.subject).toBe("Hola GallaDev");
    }
  });

  it("passes webhookSecret and svix headers to verify", () => {
    const body = JSON.stringify(makePayload());
    verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(verifyMock).toHaveBeenCalledWith({
      webhookSecret: SECRET,
      payload: body,
      headers: {
        id: "msg_123",
        timestamp: "1696000000",
        signature: "v1,valid",
      },
    });
  });

  it("rejects missing secret", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyInboundWebhook(body, VALID_HEADERS, "");
    expect(result).toEqual({ ok: false, reason: "missing-secret" });
  });

  it("rejects missing svix headers", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyInboundWebhook(
      body,
      { "svix-id": null, "svix-timestamp": null, "svix-signature": null },
      SECRET,
    );
    expect(result).toEqual({ ok: false, reason: "missing-headers" });
  });

  it("rejects bad signature (verify throws)", () => {
    verifyMock.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const body = JSON.stringify(makePayload());
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects events that are not email.received", () => {
    const payload = { type: "email.sent", data: { email_id: "em_xxx", from: "x@x.com", to: ["hola@galladev.com"] } };
    const body = JSON.stringify(payload);
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result).toEqual({ ok: false, reason: "not-email-received" });
  });

  it("rejects recipients that are not company mailboxes", () => {
    const body = JSON.stringify(makePayload({ to: ["otro@galladev.com"] }));
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result).toEqual({ ok: false, reason: "not-our-recipient" });
  });

  it("accepts ociel@galladev.com", () => {
    const body = JSON.stringify(makePayload({ to: ["ociel@galladev.com"] }));
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result.ok).toBe(true);
  });

  it("accepts ociel@galladev.com in angle-bracket format", () => {
    const body = JSON.stringify(
      makePayload({ to: ["Ociel <ociel@galladev.com>"] }),
    );
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result.ok).toBe(true);
  });

  it("accepts hola@galladev.com in cc", () => {
    const body = JSON.stringify(makePayload({ to: ["otro@example.com"], cc: ["hola@galladev.com"] }));
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result.ok).toBe(true);
  });

  it("accepts hola@galladev.com in angle-bracket format", () => {
    const body = JSON.stringify(makePayload({ to: ["GallaDev <hola@galladev.com>"] }));
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result.ok).toBe(true);
  });

  it("rejects payload without email_id", () => {
    const payload = { type: "email.received", data: { from: "x@x.com", to: ["hola@galladev.com"] } };
    const body = JSON.stringify(payload);
    const result = verifyInboundWebhook(body, VALID_HEADERS, SECRET);
    expect(result).toEqual({ ok: false, reason: "bad-payload" });
  });
});
