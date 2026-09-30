import "server-only";

import { Resend } from "resend";
import { isAllowedRecipient } from "./mailboxes";

/**
 * Verifica la firma Svix de un webhook de Resend inbound.
 *
 * Requiere el body crudo (string, antes de JSON.parse) y las cabeceras
 * svix-id, svix-timestamp, svix-signature. El secreto es
 * RESEND_INBOUND_WEBHOOK_SECRET (nunca en git).
 *
 * Solo guarda si to/cc/bcc incluye un buzón de COMPANY_MAILBOXES
 * (hola@ u ociel@). Sin catch-all.
 */

export interface InboundEmailEvent {
  type: string;
  data: {
    email_id: string;
    message_id?: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    created_at?: string;
    attachments?: Array<{
      id: string;
      filename: string;
      content_type: string;
    }>;
  };
}

export interface VerifyResult {
  ok: true;
  event: InboundEmailEvent;
}

export interface VerifyError {
  ok: false;
  reason:
    | "missing-secret"
    | "missing-headers"
    | "bad-signature"
    | "not-email-received"
    | "not-our-recipient"
    | "bad-payload";
}

let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) resendInstance = new Resend(process.env.RESEND_API_KEY ?? "unused");
  return resendInstance;
}

export function verifyInboundWebhook(
  rawBody: string,
  headers: {
    "svix-id"?: string | null;
    "svix-timestamp"?: string | null;
    "svix-signature"?: string | null;
  },
  secret?: string,
): VerifyResult | VerifyError {
  const webhookSecret = secret ?? (process.env.RESEND_INBOUND_WEBHOOK_SECRET ?? "").trim();
  if (!webhookSecret) {
    return { ok: false, reason: "missing-secret" };
  }

  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing-headers" };
  }

  let payload: unknown;
  try {
    const resend = getResend();
    payload = resend.webhooks.verify({
      webhookSecret,
      payload: rawBody,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
    });
  } catch {
    return { ok: false, reason: "bad-signature" };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "bad-payload" };
  }

  const event = payload as Record<string, unknown>;
  if (event.type !== "email.received") {
    return { ok: false, reason: "not-email-received" };
  }

  const data = event.data as InboundEmailEvent["data"] | undefined;
  if (!data?.email_id) {
    return { ok: false, reason: "bad-payload" };
  }

  const allRecipients = [
    ...(data.to ?? []),
    ...(data.cc ?? []),
    ...(data.bcc ?? []),
  ];

  if (!isAllowedRecipient(allRecipients)) {
    return { ok: false, reason: "not-our-recipient" };
  }

  return {
    ok: true,
    event: { type: "email.received", data },
  };
}


/** Solo tests: resetear instancia cacheada. */
export function __resetResendInstanceForTests(): void {
  resendInstance = null;
}
