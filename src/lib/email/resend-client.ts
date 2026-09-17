/**
 * Cliente Resend (canal clientes / transaccional).
 * Fail-open: sin API key, getResendClient() devuelve null.
 */
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

/** Remitente canal clientes. Default documentado; override con EMAIL_FROM_CLIENTS. */
export function emailFromClients(): string {
  const from = (process.env.EMAIL_FROM_CLIENTS ?? "").trim();
  return from || "GallaDev <hola@galladev.com>";
}

export function emailNotifyTo(): string {
  return (process.env.EMAIL_NOTIFY_TO ?? "").trim();
}

export function emailReplyTo(): string | undefined {
  const v = (process.env.EMAIL_REPLY_TO ?? "").trim();
  return v || undefined;
}

/** Solo tests. */
export function __resetResendClientForTests(): void {
  cached = null;
}
