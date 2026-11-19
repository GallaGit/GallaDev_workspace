import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { errorClassOf, logRouteError } from "@/lib/route-log";
import { isUuid } from "@/lib/supabase/lead-lookup";
import { isTrustedResendDownloadUrl } from "./attachment-download";
import { fetchTrustedUpstream } from "./attachment-proxy";
import { MAX_ATTACHMENT_BYTES } from "./limits";
import { getResendClient } from "./resend-client";

/**
 * Persistencia opcional de adjuntos entrantes en Supabase Storage.
 *
 * Con EMAIL_ATTACHMENTS_BUCKET vacío no cambia nada: solo metadatos y la ruta
 * /file sigue usando el proxy firmado de Resend. Con bucket configurado se
 * descargan los bytes de Resend justo después del insert y se guardan bajo una
 * ruta opaca `email/{message_id}/{attachment_id}`. Todo es best-effort: un
 * fichero que falle no debe impedir almacenar el correo.
 */

const PERSIST_ROUTE = "email/attachments.persist";

export type InboundAttachmentRow = {
  message_id: string;
  resend_attachment_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
};

type InsertedAttachmentRow = InboundAttachmentRow & { id: string };

/** Bucket privado configurado, o null si no se debe persistir nada. */
export function attachmentsBucket(): string | null {
  const bucket = (process.env.EMAIL_ATTACHMENTS_BUCKET ?? "").trim();
  return bucket || null;
}

/** Tamaños desconocidos se intentan; conocidos por encima del tope, no. */
export function canPersistAttachment(
  sizeBytes: number | null | undefined,
): boolean {
  if (sizeBytes === null || sizeBytes === undefined) return true;
  return (
    Number.isFinite(sizeBytes) && sizeBytes >= 0 && sizeBytes <= MAX_ATTACHMENT_BYTES
  );
}

/** Ruta opaca: solo UUIDs de la BD, nunca el nombre de usuario del fichero. */
export function attachmentStoragePath(
  messageId: string,
  attachmentId: string,
): string | null {
  if (!isUuid(messageId) || !isUuid(attachmentId)) return null;
  return `email/${messageId}/${attachmentId}`;
}

/** True solo para rutas opacas que hemos escrito nosotros (nunca un path libre). */
export function isPersistedStoragePath(path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== "email") return false;
  return isUuid(parts[1]) && isUuid(parts[2]);
}

/**
 * Inserta los metadatos y, solo si hay bucket, vuelve a leer las filas para
 * tener sus UUIDs, descarga cada fichero y actualiza su storage_path.
 */
export async function persistInboundAttachments(
  admin: SupabaseClient,
  emailId: string,
  rows: InboundAttachmentRow[],
): Promise<void> {
  try {
    const bucket = attachmentsBucket();
    if (!bucket) {
      const { error } = await admin.from("email_attachments").insert(rows);
      if (error) warn("metadata-insert-failed");
      return;
    }

    const { data, error } = await admin
      .from("email_attachments")
      .insert(rows)
      .select("id, message_id, resend_attachment_id, filename, content_type, size_bytes");

    if (error || !data?.length) {
      warn("metadata-select-failed");
      return;
    }

    for (const row of data as InsertedAttachmentRow[]) {
      try {
        await persistOne(admin, bucket, emailId, row);
      } catch (e) {
        warn(errorClassOf(e));
      }
    }
  } catch (e) {
    warn(errorClassOf(e));
  }
}

async function persistOne(
  admin: SupabaseClient,
  bucket: string,
  emailId: string,
  row: InsertedAttachmentRow,
): Promise<void> {
  if (!canPersistAttachment(row.size_bytes)) {
    warn("attachment-too-large");
    return;
  }

  const path = attachmentStoragePath(row.message_id, row.id);
  if (!path) {
    warn("invalid-attachment-ids");
    return;
  }

  const resendId = String(row.resend_attachment_id ?? "").trim();
  if (!resendId) {
    warn("missing-resend-attachment-id");
    return;
  }

  const bytes = await downloadAttachmentBytes(emailId, resendId);
  if (!bytes) return;

  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: row.content_type?.trim() || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    warn("storage-upload-failed");
    return;
  }

  const { error: updateError } = await admin
    .from("email_attachments")
    .update({ storage_path: path })
    .eq("id", row.id);
  if (updateError) warn("storage-path-update-failed");
}

/** Descarga acotada desde la URL firmada de Resend (nunca se expone al client). */
async function downloadAttachmentBytes(
  emailId: string,
  resendAttachmentId: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const resend = getResendClient();
  if (!resend) {
    warn("resend-no-client");
    return null;
  }

  const result = await resend.emails.receiving.attachments.get({
    emailId,
    id: resendAttachmentId,
  });
  const url = result.data?.download_url;
  if (result.error || !url) {
    warn("resend-metadata-failed");
    return null;
  }
  if (!isTrustedResendDownloadUrl(url)) {
    warn("resend-untrusted-url");
    return null;
  }

  const upstream = await fetchTrustedUpstream(url);
  if (!upstream.ok) {
    warn(`resend-download-${upstream.reason}`);
    return null;
  }

  const declared = upstream.response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_ATTACHMENT_BYTES) {
    void upstream.response.body?.cancel();
    warn("attachment-too-large");
    return null;
  }

  const reader = upstream.response.body?.getReader();
  if (!reader) {
    warn("resend-empty-body");
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ATTACHMENT_BYTES) {
      await reader.cancel();
      warn("attachment-too-large");
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Descarga desde Storage para servir el fichero; null si falla (hay fallback). */
export async function downloadPersistedAttachment(
  admin: SupabaseClient,
  bucket: string,
  storagePath: string,
): Promise<Blob | null> {
  try {
    const { data, error } = await admin.storage.from(bucket).download(storagePath);
    if (error || !data) {
      warn("storage-download-failed");
      return null;
    }
    return data;
  } catch (e) {
    warn(errorClassOf(e));
    return null;
  }
}

function warn(errorClass: string): void {
  logRouteError({ route: PERSIST_ROUTE, errorClass }, "warn");
}
