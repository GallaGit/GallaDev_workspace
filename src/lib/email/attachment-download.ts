import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { logRouteError } from "@/lib/route-log";
import { getResendClient } from "./resend-client";

export { isPreviewableContentType } from "./attachment-meta";

/**
 * Resuelve una URL firmada temporal de Resend para un adjunto nuestro.
 * El cliente solo pasa el UUID de email_attachments (nunca ids de Resend).
 * No hace proxy del fichero: solo devuelve download_url + expires_at.
 */

export type AttachmentDownloadResult =
  | {
      ok: true;
      downloadUrl: string;
      expiresAt: string;
      filename: string;
      contentType: string;
      sizeBytes: number | null;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "no-resend-id"
        | "no-client"
        | "expired"
        | "resend-error";
      detail?: string;
    };

export async function resolveAttachmentDownload(
  supabase: SupabaseClient,
  attachmentId: string,
  client?: Resend | null,
): Promise<AttachmentDownloadResult> {
  const { data: att, error: attErr } = await supabase
    .from("email_attachments")
    .select("id, message_id, filename, content_type, size_bytes, resend_attachment_id")
    .eq("id", attachmentId)
    .maybeSingle();

  if (attErr || !att) {
    return { ok: false, reason: "not-found" };
  }

  const { data: msg, error: msgErr } = await supabase
    .from("email_messages")
    .select("id, resend_email_id, direction, received_at")
    .eq("id", att.message_id)
    .maybeSingle();

  // IDOR / huérfano: el adjunto debe pertenecer a un mensaje legible (RLS).
  if (msgErr || !msg?.resend_email_id) {
    return { ok: false, reason: "not-found" };
  }

  const resendAttachmentId = String(att.resend_attachment_id ?? "").trim();
  if (!resendAttachmentId) {
    return { ok: false, reason: "no-resend-id" };
  }

  const resend = client === undefined ? getResendClient() : client;
  if (!resend) {
    return { ok: false, reason: "no-client" };
  }

  const emailId = String(msg.resend_email_id);
  const direction = msg.direction === "outbound" ? "outbound" : "inbound";

  try {
    const result =
      direction === "outbound"
        ? await resend.emails.attachments.get({
            emailId,
            id: resendAttachmentId,
          })
        : await resend.emails.receiving.attachments.get({
            emailId,
            id: resendAttachmentId,
          });

    if (result.error) {
      const status =
        typeof result.error.statusCode === "number"
          ? result.error.statusCode
          : undefined;
      logRouteError(
        {
          route: "email/attachment.download",
          status,
          errorClass: `ResendAttachment:${result.error.name || "error"}`,
        },
        "warn",
      );
      if (status === 404 || status === 410) {
        return { ok: false, reason: "expired" };
      }
      return {
        ok: false,
        reason: "resend-error",
        detail: result.error.name,
      };
    }

    const data = result.data;
    if (!data?.download_url) {
      return { ok: false, reason: "expired" };
    }

    // Defensa en profundidad: el id de Resend debe coincidir con el guardado.
    if (data.id && data.id !== resendAttachmentId) {
      logRouteError(
        {
          route: "email/attachment.download",
          errorClass: "ResendAttachment:id-mismatch",
        },
        "warn",
      );
      return { ok: false, reason: "not-found" };
    }

    return {
      ok: true,
      downloadUrl: data.download_url,
      expiresAt: data.expires_at,
      filename: att.filename || data.filename || "adjunto",
      contentType: att.content_type || data.content_type || "application/octet-stream",
      sizeBytes:
        typeof att.size_bytes === "number"
          ? att.size_bytes
          : typeof data.size === "number"
            ? data.size
            : null,
    };
  } catch (e) {
    logRouteError(
      {
        route: "email/attachment.download",
        errorClass:
          e instanceof Error && e.name
            ? `ResendAttachment:${e.name}`
            : "ResendAttachment:throw",
      },
      "warn",
    );
    return { ok: false, reason: "resend-error" };
  }
}
