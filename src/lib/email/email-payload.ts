import { z } from "zod";
import { isUuid } from "@/lib/supabase/lead-lookup";
import {
  defaultMailbox,
  isCompanyMailbox,
  isValidExternalEmail,
  type CompanyMailbox,
} from "./mailboxes";
import {
  MAX_EMAIL_ADDRESS_CHARS,
  MAX_EMAIL_BODY_CHARS,
  MAX_EMAIL_SUBJECT_CHARS,
} from "./limits";

/**
 * Un solo esquema para compose, respuesta, borrador y PATCH de hilo.
 * Longitudes máximas, UUID, buzón de la lista blanca.
 * El destinatario de una respuesta se vuelve a comprobar en `sendReply`.
 */

export const EMAIL_PAYLOAD_ERROR = "Datos del correo no válidos";

export type EmailPayloadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type ComposePayload = {
  mailbox: CompanyMailbox;
  to: string;
  subject: string;
  text: string;
  html?: string;
  draftId?: string;
  leadId?: string | null;
};

export type ReplyPayload = {
  text: string;
  html?: string;
};

export type DraftPayload = {
  id?: string;
  mailbox: CompanyMailbox;
  to: string;
  subject: string;
  bodyText: string;
  leadId: string | null;
};

export type ThreadPatch = {
  is_read?: boolean;
  lead_id?: string | null;
  /** true = Archivados; false = vuelve a Recibidos. */
  archived?: boolean;
  /** true = Papelera; false = restaurar. */
  trashed?: boolean;
};

/** Estado de bandeja que se puede aplicar a varios hilos a la vez. */
export type ThreadStatePatch = Pick<ThreadPatch, "is_read" | "archived" | "trashed">;

export type ThreadBulkPatch = {
  ids: string[];
  patch: ThreadStatePatch;
};

export type ThreadBulkPatchResult =
  | { ok: true; value: ThreadBulkPatch }
  | { ok: false; error: string };

/** Tope de hilos por PATCH masivo (una página de la lista). */
export const MAX_BULK_THREAD_IDS = 100;

export type ThreadPatchResult =
  | { ok: true; patch: ThreadPatch }
  | { ok: false; error: string };

function objectError(issue: { code?: string }): string | undefined {
  if (issue.code === "unrecognized_keys") return "Campo no permitido";
  if (issue.code === "invalid_type") return EMAIL_PAYLOAD_ERROR;
  return undefined;
}

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message || EMAIL_PAYLOAD_ERROR;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return raw != null && typeof raw === "object" && !Array.isArray(raw);
}

function unknownField(
  raw: Record<string, unknown>,
  allowed: readonly string[],
): string | null {
  const extra = Object.keys(raw).find((key) => !allowed.includes(key));
  return extra ? "Campo no permitido" : null;
}

const uuidField = z
  .string({ error: "Identificador no válido" })
  .refine(isUuid, { error: "Identificador no válido" });

const composeSchema = z.strictObject(
  {
    mailbox: z
      .string({ error: "Buzón de origen no válido" })
      .refine(isCompanyMailbox, { error: "Buzón de origen no válido" }),
    to: z
      .string({ error: "Destinatario no válido" })
      .max(MAX_EMAIL_ADDRESS_CHARS, { error: "Destinatario no válido" })
      .refine(isValidExternalEmail, { error: "Destinatario no válido" }),
    subject: z
      .string({ error: "El asunto debe ser texto" })
      .max(MAX_EMAIL_SUBJECT_CHARS, { error: "El asunto es demasiado largo" }),
    text: z
      .string({ error: "El cuerpo debe ser texto" })
      .min(1, { error: "El cuerpo no puede estar vacío" })
      .max(MAX_EMAIL_BODY_CHARS, { error: "El cuerpo es demasiado largo" }),
    html: z
      .string({ error: "El HTML debe ser texto" })
      .max(MAX_EMAIL_BODY_CHARS, { error: "El HTML es demasiado largo" })
      .optional(),
    draftId: uuidField.optional(),
    leadId: uuidField.nullable().optional(),
  },
  { error: objectError },
);

const replySchema = z.strictObject(
  {
    text: z
      .string({ error: "El texto de la respuesta debe ser texto" })
      .min(1, { error: "El texto de la respuesta no puede estar vacío" })
      .max(MAX_EMAIL_BODY_CHARS, { error: "El texto de la respuesta es demasiado largo" }),
    html: z
      .string({ error: "El HTML debe ser texto" })
      .max(MAX_EMAIL_BODY_CHARS, { error: "El HTML es demasiado largo" })
      .optional(),
  },
  { error: objectError },
);

const draftSchema = z.strictObject(
  {
    id: uuidField.optional(),
    mailbox: z
      .string({ error: "Buzón de origen no válido" })
      .refine(isCompanyMailbox, { error: "Buzón de origen no válido" }),
    to: z
      .string({ error: "El destinatario debe ser texto" })
      .max(MAX_EMAIL_ADDRESS_CHARS, { error: "El destinatario es demasiado largo" }),
    subject: z
      .string({ error: "El asunto debe ser texto" })
      .max(MAX_EMAIL_SUBJECT_CHARS, { error: "El asunto es demasiado largo" }),
    bodyText: z
      .string({ error: "El cuerpo debe ser texto" })
      .max(MAX_EMAIL_BODY_CHARS, { error: "El cuerpo es demasiado largo" }),
    leadId: uuidField.nullable(),
  },
  { error: objectError },
);

const threadStateFields = {
  is_read: z.boolean({ error: "is_read debe ser sí o no" }).optional(),
  archived: z.boolean({ error: "archived debe ser sí o no" }).optional(),
  trashed: z.boolean({ error: "trashed debe ser sí o no" }).optional(),
};

const threadBulkPatchSchema = z.strictObject(
  {
    ids: z
      .array(uuidField, { error: "ids debe ser una lista de hilos" })
      .min(1, { error: "Selecciona al menos un hilo" })
      .max(MAX_BULK_THREAD_IDS, { error: "Demasiados hilos a la vez" }),
    ...threadStateFields,
  },
  { error: objectError },
);

const threadPatchSchema = z.strictObject(
  {
    ...threadStateFields,
    lead_id: z
      .union(
        [
          z
            .string({ error: "lead_id no es un UUID" })
            .refine(isUuid, { error: "lead_id no es un UUID" }),
          z.null(),
        ],
        { error: "lead_id no es un UUID" },
      )
      .optional(),
  },
  { error: objectError },
);

function optionalUuid(
  body: Record<string, unknown>,
  key: string,
): { ok: true; value?: string } | { ok: false; error: string } {
  if (!(key in body) || body[key] == null || body[key] === "") {
    return { ok: true };
  }
  if (typeof body[key] !== "string" || !isUuid(body[key].trim())) {
    return { ok: false, error: "Identificador no válido" };
  }
  return { ok: true, value: body[key].trim() };
}

export function parseComposeBody(raw: unknown): EmailPayloadResult<ComposePayload> {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const unknown = unknownField(raw, [
    "mailbox",
    "to",
    "subject",
    "text",
    "html",
    "draftId",
    "leadId",
  ]);
  if (unknown) return { ok: false, error: unknown };
  const draftId = optionalUuid(raw, "draftId");
  if (!draftId.ok) return draftId;
  let leadId: string | null | undefined;
  if ("leadId" in raw && raw.leadId != null && raw.leadId !== "") {
    if (typeof raw.leadId !== "string" || !isUuid(raw.leadId.trim())) {
      return { ok: false, error: "Identificador no válido" };
    }
    leadId = raw.leadId.trim();
  } else if (raw.leadId === null) {
    leadId = null;
  }
  const normalized: Record<string, unknown> = {
    mailbox: typeof raw.mailbox === "string" ? raw.mailbox.trim().toLowerCase() : raw.mailbox,
    to: typeof raw.to === "string" ? raw.to.trim() : raw.to,
    subject: typeof raw.subject === "string" ? raw.subject.trim() : raw.subject ?? "",
    text: typeof raw.text === "string" ? raw.text.trim() : raw.text,
  };
  if (typeof raw.html === "string" && raw.html.trim()) normalized.html = raw.html.trim();
  else if ("html" in raw && raw.html != null && raw.html !== "") normalized.html = raw.html;
  if (draftId.value) normalized.draftId = draftId.value;
  if (leadId !== undefined) normalized.leadId = leadId;
  const parsed = composeSchema.safeParse(normalized);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const mailbox = parsed.data.mailbox;
  if (!isCompanyMailbox(mailbox)) {
    return { ok: false, error: "Buzón de origen no válido" };
  }
  return {
    ok: true,
    value: {
      mailbox,
      to: parsed.data.to,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: parsed.data.html,
      draftId: parsed.data.draftId,
      leadId: parsed.data.leadId,
    },
  };
}

export function parseReplyBody(raw: unknown): EmailPayloadResult<ReplyPayload> {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const unknown = unknownField(raw, ["text", "html"]);
  if (unknown) return { ok: false, error: unknown };
  const normalized: Record<string, unknown> = {
    text: typeof raw.text === "string" ? raw.text.trim() : raw.text,
  };
  if (typeof raw.html === "string" && raw.html.trim()) normalized.html = raw.html.trim();
  else if ("html" in raw && raw.html != null && raw.html !== "") normalized.html = raw.html;
  const parsed = replySchema.safeParse(normalized);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  return { ok: true, value: { text: parsed.data.text, html: parsed.data.html } };
}

export function parseDraftBody(raw: unknown): EmailPayloadResult<DraftPayload> {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const unknown = unknownField(raw, [
    "id",
    "mailbox",
    "to",
    "subject",
    "bodyText",
    "leadId",
  ]);
  if (unknown) return { ok: false, error: unknown };
  const id = optionalUuid(raw, "id");
  if (!id.ok) return id;
  let leadId: string | null = null;
  if ("leadId" in raw && raw.leadId != null && raw.leadId !== "") {
    if (typeof raw.leadId !== "string" || !isUuid(raw.leadId.trim())) {
      return { ok: false, error: "Identificador no válido" };
    }
    leadId = raw.leadId.trim();
  }
  const mailboxRaw = typeof raw.mailbox === "string" ? raw.mailbox.trim().toLowerCase() : "";
  const mailbox = mailboxRaw ? mailboxRaw : defaultMailbox();
  const normalized: Record<string, unknown> = {
    mailbox,
    to: typeof raw.to === "string" ? raw.to.trim() : raw.to ?? "",
    subject: typeof raw.subject === "string" ? raw.subject : raw.subject ?? "",
    bodyText: typeof raw.bodyText === "string" ? raw.bodyText : raw.bodyText ?? "",
    leadId,
  };
  if (id.value) normalized.id = id.value;
  const parsed = draftSchema.safeParse(normalized);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!isCompanyMailbox(parsed.data.mailbox)) {
    return { ok: false, error: "Buzón de origen no válido" };
  }
  return {
    ok: true,
    value: {
      id: parsed.data.id,
      mailbox: parsed.data.mailbox,
      to: parsed.data.to,
      subject: parsed.data.subject,
      bodyText: parsed.data.bodyText,
      leadId: parsed.data.leadId,
    },
  };
}

export function parseThreadPatch(raw: unknown): ThreadPatchResult {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const parsed = threadPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const patch: ThreadPatch = {};
  if (parsed.data.is_read !== undefined) patch.is_read = parsed.data.is_read;
  if (parsed.data.lead_id !== undefined) patch.lead_id = parsed.data.lead_id;
  if (parsed.data.archived !== undefined) patch.archived = parsed.data.archived;
  if (parsed.data.trashed !== undefined) patch.trashed = parsed.data.trashed;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada que actualizar" };
  }
  return { ok: true, patch };
}

/** PATCH masivo: `ids` (UUID, 1–100, sin duplicados) y estado de bandeja. */
export function parseThreadBulkPatch(raw: unknown): ThreadBulkPatchResult {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const parsed = threadBulkPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const patch: ThreadStatePatch = {};
  if (parsed.data.is_read !== undefined) patch.is_read = parsed.data.is_read;
  if (parsed.data.archived !== undefined) patch.archived = parsed.data.archived;
  if (parsed.data.trashed !== undefined) patch.trashed = parsed.data.trashed;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada que actualizar" };
  }
  const ids = Array.from(new Set(parsed.data.ids.map((id) => id.toLowerCase())));
  return { ok: true, value: { ids, patch } };
}
