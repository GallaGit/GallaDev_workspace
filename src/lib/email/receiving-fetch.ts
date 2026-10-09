import "server-only";

import type { Resend } from "resend";
import { logRouteError } from "@/lib/route-log";
import { getResendClient } from "./resend-client";

/** Attachment metadata from Resend Receiving API. */
export interface ReceivingAttachmentMeta {
  id: string;
  filename?: string | null;
  content_type?: string | null;
  size?: number | null;
  content_id?: string | null;
}

export interface ReceivingEmailContent {
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  messageId: string | null;
  attachments: ReceivingAttachmentMeta[];
}

export type ReceivingFetchResult =
  | { ok: true; data: ReceivingEmailContent }
  | { ok: false; status?: number; errorName: string };

/**
 * Carga el cuerpo y cabeceras de un correo recibido vía Receiving API.
 * Una sola llamada con `html_format: 'cid'` (evita data: URI enormes).
 * El SDK no lanza: si hay `error`, se registra y se devuelve ok:false.
 */
export async function fetchReceivingEmail(
  emailId: string,
  client?: Resend | null,
): Promise<ReceivingFetchResult> {
  const resend = client === undefined ? getResendClient() : client;
  if (!resend) {
    logRouteError(
      {
        route: "email/receiving.get",
        errorClass: "ResendReceiving:no-client",
      },
      "warn",
    );
    return { ok: false, errorName: "no-client" };
  }

  try {
    const result = await resend.emails.receiving.get(emailId, {
      html_format: "cid",
    });

    if (result.error) {
      const status =
        typeof result.error.statusCode === "number"
          ? result.error.statusCode
          : undefined;
      const errorName =
        typeof result.error.name === "string" && result.error.name
          ? result.error.name
          : "error";
      logRouteError(
        {
          route: "email/receiving.get",
          status,
          errorClass: `ResendReceiving:${errorName}`,
        },
        "warn",
      );
      return { ok: false, status, errorName };
    }

    if (!result.data) {
      logRouteError(
        {
          route: "email/receiving.get",
          errorClass: "ResendReceiving:empty",
        },
        "warn",
      );
      return { ok: false, errorName: "empty" };
    }

    const data = result.data;
    return {
      ok: true,
      data: {
        html: data.html ?? null,
        text: data.text ?? null,
        headers: data.headers ?? null,
        messageId: data.message_id ?? null,
        attachments: (data.attachments ?? []).map((a) => ({
          id: a.id,
          filename: a.filename,
          content_type: a.content_type,
          size: a.size,
          content_id: a.content_id,
        })),
      },
    };
  } catch (e) {
    logRouteError(
      {
        route: "email/receiving.get",
        errorClass:
          e instanceof Error && e.name ? `ResendReceiving:${e.name}` : "ResendReceiving:throw",
      },
      "warn",
    );
    return { ok: false, errorName: "throw" };
  }
}

/** Lee In-Reply-To / References desde `headers` (SDK v6; no hay campos top-level). */
export function threadingFromHeaders(
  headers: Record<string, string> | null | undefined,
): { inReplyTo: string | null; references: string | null } {
  if (!headers) return { inReplyTo: null, references: null };
  return {
    inReplyTo: headerValue(headers, "in-reply-to"),
    references: headerValue(headers, "references"),
  };
}

function headerValue(
  headers: Record<string, string>,
  name: string,
): string | null {
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) {
      const trimmed = value.trim();
      return trimmed || null;
    }
  }
  return null;
}

/** Message-ID RFC propio para envíos (Resend no lo devuelve en el send). */
export function createOutboundMessageId(): string {
  return `<${crypto.randomUUID()}@galladev.com>`;
}
