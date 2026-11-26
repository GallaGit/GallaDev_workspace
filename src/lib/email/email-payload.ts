import { z } from "zod";
import { isUuid } from "@/lib/supabase/lead-lookup";
import {
  defaultMailbox,
  isCompanyMailbox,
  isValidExternalEmail,
  type CompanyMailbox,
} from "./mailboxes";
import {
  exceedsRecipientTotal,
  MAX_RECIPIENT_FIELD_CHARS,
  parseRecipientList,
} from "./recipients";
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
  /** Copia (Cc) y copia oculta (Cco), ya validadas y en minúsculas. */
  cc?: string[];
  bcc?: string[];
};

export type ReplyPayload = {
  text: string;
  html?: string;
  mode?: "reply" | "replyAll";
  /** Cc/Cco adicionales a los de «Responder a todos». */
  cc?: string[];
  bcc?: string[];
};

export type ForwardPayload = {
  to: string;
  text: string;
  cc?: string[];
  bcc?: string[];
};

export type DraftPayload = {
  id?: string;
  mailbox: CompanyMailbox;
  to: string;
  subject: string;
  bodyText: string;
  /** Texto libre de Cc/Cco (puede tener direcciones a medio escribir). */
  cc?: string;
  bcc?: string;
  /** undefined = no vino en el body (al actualizar, no tocar lead_id). */
  leadId?: string | null;
  /** Borrador de respuesta de un hilo (uno por hilo). */
  threadId?: string;
  replyMode?: "reply" | "replyAll";
  /**
   * Si es true, se actualiza el borrador de mensaje nuevo de ese lead
   * (thread_id IS NULL) o se crea uno. Exige leadId.
   */
  upsertByLead?: boolean;
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
    mode: z.enum(["reply", "replyAll"], { error: "Modo de respuesta no válido" }).optional(),
  },
  { error: objectError },
);

const forwardSchema = z.strictObject(
  {
    to: z
      .string({ error: "Destinatario no válido" })
      .max(MAX_EMAIL_ADDRESS_CHARS, { error: "Destinatario no válido" })
      .refine(isValidExternalEmail, { error: "Destinatario no válido" }),
    text: z
      .string({ error: "El cuerpo debe ser texto" })
      .max(MAX_EMAIL_BODY_CHARS, { error: "El cuerpo es demasiado largo" }),
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
    cc: z
      .string({ error: "Cc debe ser texto" })
      .max(MAX_RECIPIENT_FIELD_CHARS, { error: "Cc es demasiado largo" })
      .optional(),
    bcc: z
      .string({ error: "Cco debe ser texto" })
      .max(MAX_RECIPIENT_FIELD_CHARS, { error: "Cco es demasiado largo" })
      .optional(),
    leadId: uuidField.nullable().optional(),
    threadId: uuidField.optional(),
    replyMode: z.enum(["reply", "replyAll"], { error: "Modo de respuesta no válido" }).optional(),
    upsertByLead: z.boolean({ error: "upsertByLead debe ser sí o no" }).optional(),
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

const CC_LABEL = "Cc";
const BCC_LABEL = "Cco";

/** Cc y Cco de la petición (opcionales). Solo incluye las claves con datos. */
function parseCopyFields(
  raw: Record<string, unknown>,
  to: string[],
): { ok: true; value: { cc?: string[]; bcc?: string[] } } | { ok: false; error: string } {
  const cc = parseRecipientList(raw.cc, CC_LABEL);
  if (!cc.ok) return cc;
  const bcc = parseRecipientList(raw.bcc, BCC_LABEL);
  if (!bcc.ok) return bcc;
  if (exceedsRecipientTotal({ to, cc: cc.value, bcc: bcc.value })) {
    return { ok: false, error: "Demasiados destinatarios" };
  }
  return {
    ok: true,
    value: {
      ...(cc.value.length > 0 ? { cc: cc.value } : {}),
      ...(bcc.value.length > 0 ? { bcc: bcc.value } : {}),
    },
  };
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
    "cc",
    "bcc",
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
  const copies = parseCopyFields(raw, [parsed.data.to]);
  if (!copies.ok) return copies;
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
      ...copies.value,
    },
  };
}

export function parseReplyBody(raw: unknown): EmailPayloadResult<ReplyPayload> {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const unknown = unknownField(raw, ["text", "html", "mode", "cc", "bcc"]);
  if (unknown) return { ok: false, error: unknown };
  const normalized: Record<string, unknown> = {
    text: typeof raw.text === "string" ? raw.text.trim() : raw.text,
  };
  if (raw.mode !== undefined) normalized.mode = raw.mode;
  if (typeof raw.html === "string" && raw.html.trim()) normalized.html = raw.html.trim();
  else if ("html" in raw && raw.html != null && raw.html !== "") normalized.html = raw.html;
  const parsed = replySchema.safeParse(normalized);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const copies = parseCopyFields(raw, []);
  if (!copies.ok) return copies;
  return {
    ok: true,
    value: {
      text: parsed.data.text,
      html: parsed.data.html,
      ...(parsed.data.mode ? { mode: parsed.data.mode } : {}),
      ...copies.value,
    },
  };
}

export function parseForwardBody(raw: unknown): EmailPayloadResult<ForwardPayload> {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const unknown = unknownField(raw, ["to", "text", "cc", "bcc"]);
  if (unknown) return { ok: false, error: unknown };
  const parsed = forwardSchema.safeParse({
    to: typeof raw.to === "string" ? raw.to.trim() : raw.to,
    text: typeof raw.text === "string" ? raw.text.trim() : raw.text ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const copies = parseCopyFields(raw, [parsed.data.to]);
  if (!copies.ok) return copies;
  return {
    ok: true,
    value: { to: parsed.data.to, text: parsed.data.text, ...copies.value },
  };
}

export function parseDraftBody(raw: unknown): EmailPayloadResult<DraftPayload> {
  if (!isRecord(raw)) return { ok: false, error: EMAIL_PAYLOAD_ERROR };
  const unknown = unknownField(raw, [
    "id",
    "mailbox",
    "to",
    "subject",
    "bodyText",
    "cc",
    "bcc",
    "leadId",
    "threadId",
    "replyMode",
    "upsertByLead",
  ]);
  if (unknown) return { ok: false, error: unknown };
  const id = optionalUuid(raw, "id");
  if (!id.ok) return id;
  const threadId = optionalUuid(raw, "threadId");
  if (!threadId.ok) return threadId;
  let leadId: string | null | undefined;
  if ("leadId" in raw) {
    if (raw.leadId != null && raw.leadId !== "") {
      if (typeof raw.leadId !== "string" || !isUuid(raw.leadId.trim())) {
        return { ok: false, error: "Identificador no válido" };
      }
      leadId = raw.leadId.trim();
    } else if (raw.leadId === null) {
      leadId = null;
    }
  }
  if (raw.upsertByLead !== undefined && typeof raw.upsertByLead !== "boolean") {
    return { ok: false, error: "upsertByLead debe ser sí o no" };
  }
  const mailboxRaw = typeof raw.mailbox === "string" ? raw.mailbox.trim().toLowerCase() : "";
  const mailbox = mailboxRaw ? mailboxRaw : defaultMailbox();
  const normalized: Record<string, unknown> = {
    mailbox,
    to: typeof raw.to === "string" ? raw.to.trim() : raw.to ?? "",
    subject: typeof raw.subject === "string" ? raw.subject : raw.subject ?? "",
    bodyText: typeof raw.bodyText === "string" ? raw.bodyText : raw.bodyText ?? "",
  };
  if (leadId !== undefined) normalized.leadId = leadId;
  if (raw.upsertByLead === true) normalized.upsertByLead = true;
  if (raw.cc !== undefined) normalized.cc = typeof raw.cc === "string" ? raw.cc.trim() : raw.cc;
  if (raw.bcc !== undefined) normalized.bcc = typeof raw.bcc === "string" ? raw.bcc.trim() : raw.bcc;
  if (id.value) normalized.id = id.value;
  if (threadId.value) normalized.threadId = threadId.value;
  if (raw.replyMode !== undefined) normalized.replyMode = raw.replyMode;
  const parsed = draftSchema.safeParse(normalized);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!isCompanyMailbox(parsed.data.mailbox)) {
    return { ok: false, error: "Buzón de origen no válido" };
  }
  if (parsed.data.upsertByLead && !parsed.data.leadId) {
    return { ok: false, error: "Identificador no válido" };
  }
  return {
    ok: true,
    value: {
      id: parsed.data.id,
      mailbox: parsed.data.mailbox,
      to: parsed.data.to,
      subject: parsed.data.subject,
      bodyText: parsed.data.bodyText,
      ...(parsed.data.cc ? { cc: parsed.data.cc } : {}),
      ...(parsed.data.bcc ? { bcc: parsed.data.bcc } : {}),
      ...(parsed.data.leadId !== undefined ? { leadId: parsed.data.leadId } : {}),
      ...(parsed.data.threadId ? { threadId: parsed.data.threadId } : {}),
      ...(parsed.data.replyMode ? { replyMode: parsed.data.replyMode } : {}),
      ...(parsed.data.upsertByLead ? { upsertByLead: true } : {}),
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
