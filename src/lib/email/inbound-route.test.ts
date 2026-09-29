import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import type { VerifyError } from "@/lib/email/inbound-verify";

/**
 * Contratos de POST /api/email/inbound (webhook Resend).
 * Sin sesión de usuario: la ruta usa firma Svix + service_role.
 */

const storeInboundEmail = vi.hoisted(() =>
  vi.fn(async () => ({
    stored: true as const,
    threadId: "thread-1",
    messageId: "msg-1",
  })),
);

const verifyInboundWebhook = vi.hoisted(() =>
  vi.fn(() => ({
    ok: true as const,
    event: {
      type: "email.received" as const,
      data: {
        email_id: "em_abc123",
        message_id: "<abc@mail.example.com>",
        from: "Test <test@example.com>",
        to: ["hola@galladev.com"],
        subject: "Hola",
      },
    },
  })),
);

vi.mock("@/lib/email/inbound-verify", () => ({
  verifyInboundWebhook,
}));

vi.mock("@/lib/email/inbound-store", () => ({
  storeInboundEmail,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}));

const INBOUND_URL = "http://localhost/api/email/inbound";

const VALID_HEADERS = {
  "svix-id": "msg_123",
  "svix-timestamp": "1696000000",
  "svix-signature": "v1,valid",
  "content-type": "application/json",
};

function webhookRequest(
  options: {
    body?: string;
    headers?: Record<string, string>;
    ip?: string;
  } = {},
): Request {
  const headers = new Headers({ ...VALID_HEADERS, ...options.headers });
  if (options.ip) headers.set("x-forwarded-for", options.ip);
  return new Request(INBOUND_URL, {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify({ type: "email.received", data: {} }),
  });
}

describe("POST /api/email/inbound", () => {
  beforeEach(() => {
    resetRateLimits();
    verifyInboundWebhook.mockReturnValue({
      ok: true,
      event: {
        type: "email.received",
        data: {
          email_id: "em_abc123",
          message_id: "<abc@mail.example.com>",
          from: "Test <test@example.com>",
          to: ["hola@galladev.com"],
          subject: "Hola",
        },
      },
    });
    storeInboundEmail.mockResolvedValue({
      stored: true,
      threadId: "thread-1",
      messageId: "msg-1",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("201 on valid webhook", async () => {
    const { POST } = await import("@/app/api/email/inbound/route");
    const res = await POST(webhookRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.threadId).toBe("thread-1");
  });

  it("200 on duplicate", async () => {
    storeInboundEmail.mockResolvedValue({ stored: false, reason: "duplicate" });
    const { POST } = await import("@/app/api/email/inbound/route");
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(true);
  });

  it("401 on bad signature", async () => {
    verifyInboundWebhook.mockReturnValue({
      ok: false,
      reason: "bad-signature",
    } satisfies VerifyError);
    const { POST } = await import("@/app/api/email/inbound/route");
    const res = await POST(webhookRequest());
    expect(res.status).toBe(401);
  });

  it("200 on not-our-recipient (accept but skip)", async () => {
    verifyInboundWebhook.mockReturnValue({
      ok: false,
      reason: "not-our-recipient",
    } satisfies VerifyError);
    const { POST } = await import("@/app/api/email/inbound/route");
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(storeInboundEmail).not.toHaveBeenCalled();
  });

  it("413 on oversized body", async () => {
    const hugeBody = "x".repeat(256 * 1024 + 1);
    const { POST } = await import("@/app/api/email/inbound/route");
    const res = await POST(webhookRequest({ body: hugeBody }));
    expect(res.status).toBe(413);
  });

  it("429 on rate limit", async () => {
    const { POST } = await import("@/app/api/email/inbound/route");
    for (let i = 0; i < 60; i++) {
      await POST(webhookRequest({ ip: "1.2.3.4" }));
    }
    const res = await POST(webhookRequest({ ip: "1.2.3.4" }));
    expect(res.status).toBe(429);
  });
});
