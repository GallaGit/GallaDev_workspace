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

/** Datos de la fila autorizada por RLS, sin contactar con Resend todavía. */
export type AttachmentRowContext = {
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  storagePath: string | null;
  resendAttachmentId: string;
  resendEmailId: string;
  direction: "inbound" | "outbound";
};

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
        | "resend-error"
        | "untrusted-url";
      detail?: string;
    };

export async function resolveAttachmentDownload(
  supabase: SupabaseClient,
  attachmentId: string,
  client?: Resend | null,
): Promise<AttachmentDownloadResult> {
  const context = await resolveAttachmentContext(supabase, attachmentId);
  if (!context) {
    return { ok: false, reason: "not-found" };
  }

  const {
    resendAttachmentId,
    resendEmailId: emailId,
    direction,
    filename,
    contentType,
    sizeBytes,
  } = context;
  if (!resendAttachmentId) {
    return { ok: false, reason: "no-resend-id" };
  }

  const resend = client === undefined ? getResendClient() : client;
  if (!resend) {
    return { ok: false, reason: "no-client" };
  }

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

    // GDW-SEC-023: solo https y hosts de Resend.
    if (!isTrustedResendDownloadUrl(data.download_url)) {
      logRouteError(
        {
          route: "email/attachment.download",
          errorClass: "ResendAttachment:untrusted-url",
        },
        "warn",
      );
      return { ok: false, reason: "untrusted-url" };
    }

    return {
      ok: true,
      downloadUrl: data.download_url,
      expiresAt: data.expires_at,
      filename: filename || data.filename || "adjunto",
      contentType: contentType || data.content_type || "application/octet-stream",
      sizeBytes:
        typeof sizeBytes === "number"
          ? sizeBytes
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

/**
 * Fila legible por RLS (adjunto + mensaje), sin pedir aún la URL a Resend.
 * La usa /file para intentar Storage antes de caer al proxy firmado.
 */
export async function resolveAttachmentContext(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<AttachmentRowContext | null> {
  const { data: att, error: attErr } = await supabase
    .from("email_attachments")
    .select(
      "message_id, filename, content_type, size_bytes, storage_path, resend_attachment_id",
    )
    .eq("id", attachmentId)
    .maybeSingle();

  if (attErr || !att) return null;

  const { data: msg, error: msgErr } = await supabase
    .from("email_messages")
    .select("id, resend_email_id, direction")
    .eq("id", att.message_id)
    .maybeSingle();

  // IDOR / huérfano: el adjunto debe pertenecer a un mensaje legible (RLS).
  if (msgErr || !msg?.resend_email_id) return null;

  return {
    filename: att.filename || "adjunto",
    contentType: att.content_type || "application/octet-stream",
    sizeBytes: typeof att.size_bytes === "number" ? att.size_bytes : null,
    storagePath:
      typeof att.storage_path === "string" && att.storage_path.trim()
        ? att.storage_path.trim()
        : null,
    resendAttachmentId: String(att.resend_attachment_id ?? "").trim(),
    resendEmailId: String(msg.resend_email_id),
    direction: msg.direction === "outbound" ? "outbound" : "inbound",
  };
}

const TRUSTED_RESEND_DOMAINS = ["resend.com", "resend.dev", "resend.app"];

/** GDW-SEC-023: true si la URL es https, sin credenciales y de un host Resend. */
export function isTrustedResendDownloadUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return TRUSTED_RESEND_DOMAINS.some(
    (d) => host === d || host.endsWith(`.${d}`),
  );
}
