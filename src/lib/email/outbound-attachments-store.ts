import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { errorClassOf, logRouteError } from "@/lib/route-log";
import {
  attachmentStoragePath,
  attachmentsBucket,
  canPersistAttachment,
} from "./attachment-persist";
import { validateAttachmentSet } from "./outbound-attachments";

/**
 * Adjuntos de un correo saliente.
 *
 * Los bytes viajan a Resend como `content` (base64) en el mismo envío. Después
 * se guardan los metadatos en `email_attachments` y, si hay
 * EMAIL_ATTACHMENTS_BUCKET, los bytes en Storage con la misma ruta opaca
 * `email/{message_id}/{attachment_id}` que los entrantes. Sin bucket solo
 * quedan los metadatos, y el id de Resend (si se puede leer) para descargarlos
 * mientras Resend conserve el correo (~30 días). Todo es best-effort: un fallo
 * aquí nunca debe tumbar un correo que ya salió.
 */

const PERSIST_ROUTE = "email/attachments.persist-outbound";

export type OutboundAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

/** Forma que espera `emails.send` de Resend. */
export function toResendAttachments(files: readonly OutboundAttachment[]) {
  return files.map((file) => ({
    filename: file.filename,
    content: file.content,
    contentType: file.contentType,
  }));
}

/** Defensa en profundidad: la ruta ya valida, el sender vuelve a comprobar. */
export function attachmentsAreValid(files: readonly OutboundAttachment[]): boolean {
  return validateAttachmentSet(
    files.map((file) => ({ name: file.filename, size: file.content.byteLength })),
  ).ok;
}

/** Ids de Resend de los adjuntos enviados, emparejados por nombre y orden. */
async function resendAttachmentIds(
  client: Resend,
  resendEmailId: string,
  files: readonly OutboundAttachment[],
): Promise<Array<string | null>> {
  const ids: Array<string | null> = files.map(() => null);
  try {
    const listed = await client.emails.attachments.list({ emailId: resendEmailId });
    const remote = [...(listed.data?.data ?? [])];
    files.forEach((file, index) => {
      const at = remote.findIndex((item) => item.filename === file.filename);
      if (at < 0) return;
      const [match] = remote.splice(at, 1);
      ids[index] = match?.id ?? null;
    });
  } catch (e) {
    warn(errorClassOf(e));
  }
  return ids;
}

export async function storeOutboundAttachments(
  admin: SupabaseClient,
  client: Resend,
  input: {
    messageId: string;
    resendEmailId: string;
    files: readonly OutboundAttachment[];
  },
): Promise<void> {
  if (input.files.length === 0) return;
  try {
    const resendIds = await resendAttachmentIds(
      client,
      input.resendEmailId,
      input.files,
    );
    const rows = input.files.map((file, index) => ({
      id: randomUUID(),
      message_id: input.messageId,
      resend_attachment_id: resendIds[index],
      filename: file.filename,
      content_type: file.contentType,
      size_bytes: file.content.byteLength,
    }));

    const { error } = await admin.from("email_attachments").insert(rows);
    if (error) {
      warn("metadata-insert-failed");
      return;
    }

    const bucket = attachmentsBucket();
    if (!bucket) return;

    for (const [index, row] of rows.entries()) {
      try {
        await persistOne(admin, bucket, row, input.files[index]);
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
  row: { id: string; message_id: string; content_type: string; size_bytes: number },
  file: OutboundAttachment,
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
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(path, file.content, {
      contentType: row.content_type || "application/octet-stream",
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

function warn(errorClass: string): void {
  logRouteError({ route: PERSIST_ROUTE, errorClass }, "warn");
}
