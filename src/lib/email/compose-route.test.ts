import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCorreoAccess = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => false));
const sendCompose = vi.hoisted(() => vi.fn());
const sendReply = vi.hoisted(() => vi.fn());
const sendForward = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireCorreoAccess }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit,
}));
vi.mock("@/lib/email/send-compose", () => ({ sendCompose }));
vi.mock("@/lib/email/send-reply", () => ({ sendReply }));
vi.mock("@/lib/email/send-forward", () => ({ sendForward }));

import { POST as compose } from "@/app/api/email/compose/route";
import { POST as reply } from "@/app/api/email/threads/[id]/reply/route";
import { POST as forward } from "@/app/api/email/threads/[id]/forward/route";

const THREAD = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";

function multipartRequest(url: string, payload: unknown, files: { name: string; content: string }[]): Request {
  const boundary = "----gdw-route-boundary";
  let body = `--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(payload)}\r\n`;
  for (const f of files) {
    body +=
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${f.name}"\r\n` +
      `Content-Type: text/plain\r\n\r\n${f.content}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: new TextEncoder().encode(body),
  });
}

function jsonRequest(url: string, payload: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const composePayload = {
  mailbox: "hola@galladev.com",
  to: "cliente@example.com",
  subject: "Hola",
  text: "Cuerpo",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireCorreoAccess.mockResolvedValue(null);
  consumeRateLimit.mockResolvedValue(false);
  sendCompose.mockResolvedValue({ sent: true, threadId: "t1", messageId: "m1" });
  sendReply.mockResolvedValue({ sent: true, messageId: "m1" });
  sendForward.mockResolvedValue({ sent: true, messageId: "m1", attached: 0, missing: [] });
  createSupabaseServerClient.mockResolvedValue({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: THREAD } }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  });
});

describe("POST /api/email/compose", () => {
  it("sin Admin no procesa nada", async () => {
    requireCorreoAccess.mockResolvedValue(new Response("{}", { status: 403 }));
    const res = await compose(jsonRequest("http://localhost/api/email/compose", composePayload));
    expect(res.status).toBe(403);
    expect(sendCompose).not.toHaveBeenCalled();
  });

  it("JSON con Cc/Cco: los pasa a sendCompose sin adjuntos", async () => {
    const res = await compose(
      jsonRequest("http://localhost/api/email/compose", {
        ...composePayload,
        cc: ["ana@example.com"],
        bcc: "jefe@example.com",
      }),
    );
    expect(res.status).toBe(201);
    expect(sendCompose).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cc: ["ana@example.com"],
        bcc: ["jefe@example.com"],
        attachments: [],
      }),
    );
  });

  it("multipart: pasa los adjuntos con nombre y contenido a sendCompose", async () => {
    const res = await compose(
      multipartRequest(
        "http://localhost/api/email/compose",
        { ...composePayload, cc: ["ana@example.com"] },
        [{ name: "nota.txt", content: "hola" }],
      ),
    );
    expect(res.status).toBe(201);
    const input = sendCompose.mock.calls[0][1];
    expect(input.cc).toEqual(["ana@example.com"]);
    expect(input.attachments).toHaveLength(1);
    expect(input.attachments[0]).toMatchObject({ filename: "nota.txt", contentType: "text/plain" });
    expect(input.attachments[0].content.toString()).toBe("hola");
  });

  it("multipart con un ejecutable devuelve 400 sin enviar", async () => {
    const res = await compose(
      multipartRequest("http://localhost/api/email/compose", composePayload, [
        { name: "virus.exe", content: "x" },
      ]),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("virus.exe");
    expect(sendCompose).not.toHaveBeenCalled();
  });

  it("Cc no válido devuelve 400 sin enviar", async () => {
    const res = await compose(
      jsonRequest("http://localhost/api/email/compose", { ...composePayload, cc: ["nope"] }),
    );
    expect(res.status).toBe(400);
    expect(sendCompose).not.toHaveBeenCalled();
  });

  it("traduce los fallos de validación del sender a 400", async () => {
    sendCompose.mockResolvedValue({ sent: false, reason: "invalid-attachments" });
    const res = await compose(jsonRequest("http://localhost/api/email/compose", composePayload));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/email/threads/[id]/reply y /forward", () => {
  const ctx = { params: Promise.resolve({ id: THREAD }) };

  it("reply: Cc/Cco y adjuntos llegan a sendReply", async () => {
    const res = await reply(
      multipartRequest(
        `http://localhost/api/email/threads/${THREAD}/reply`,
        { text: "Hola", cc: ["ana@example.com"], bcc: ["jefe@example.com"] },
        [{ name: "nota.txt", content: "hola" }],
      ),
      ctx,
    );
    expect(res.status).toBe(201);
    const input = sendReply.mock.calls[0][1];
    expect(input).toMatchObject({ threadId: THREAD, cc: ["ana@example.com"], bcc: ["jefe@example.com"] });
    expect(input.attachments).toHaveLength(1);
  });

  it("forward: Cc y adjuntos llegan a sendForward", async () => {
    const res = await forward(
      multipartRequest(
        `http://localhost/api/email/threads/${THREAD}/forward`,
        { to: "bob@example.com", text: "FYI", cc: ["ana@example.com"] },
        [{ name: "nota.txt", content: "hola" }],
      ),
      ctx,
    );
    expect(res.status).toBe(201);
    const input = sendForward.mock.calls[0][1];
    expect(input).toMatchObject({ to: "bob@example.com", cc: ["ana@example.com"] });
    expect(input.attachments).toHaveLength(1);
  });

  it("reply sin adjuntos sigue aceptando JSON", async () => {
    const res = await reply(
      jsonRequest(`http://localhost/api/email/threads/${THREAD}/reply`, { text: "Hola" }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect(sendReply.mock.calls[0][1].attachments).toEqual([]);
  });
});
