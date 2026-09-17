/**
 * Emails transaccionales tras POST /api/ingest/lead (canal clientes).
 * NO marketing: solo acuse al visitante + aviso interno a EMAIL_NOTIFY_TO.
 * Fail-open: errores se loguean; el caller no debe devolver 500 por mail.
 */

import {
  emailFromClients,
  emailNotifyTo,
  emailReplyTo,
  getResendClient,
} from "./resend-client";

export interface IngestEmailPayload {
  name: string;
  email: string;
  company: string;
  message: string;
  leadId?: string;
  deduped?: boolean;
}

function excerpt(message: string, max = 280): string {
  const t = message.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function visitorSubject(): string {
  return "GallaDev — hemos recibido tu mensaje";
}

function visitorText(p: IngestEmailPayload): string {
  const hello = p.name ? `Hola ${p.name},` : "Hola,";
  return [
    hello,
    "",
    "Gracias por escribirnos. Hemos recibido tu mensaje y te responderemos",
    "en cuanto podamos.",
    "",
    "Un saludo,",
    "GallaDev",
  ].join("\n");
}

function notifySubject(deduped?: boolean): string {
  const dedupe = deduped ? " (dedupe)" : "";
  return `[GallaDev form] nuevo lead${dedupe}`;
}

function notifyText(p: IngestEmailPayload): string {
  const lines = [
    "Lead web (formulario galladev.com)",
    p.deduped ? "Fusión por email existente (dedupe)." : "Alta nueva.",
    "",
    `Nombre: ${p.name}`,
    `Email: ${p.email}`,
    `Empresa: ${p.company || "(sin empresa)"}`,
    p.leadId ? `Lead id: ${p.leadId}` : null,
    "",
    "Mensaje:",
    excerpt(p.message),
  ].filter((x): x is string => x !== null);
  return lines.join("\n");
}

export type SendIngestEmailsResult = {
  visitorSent: boolean;
  notifySent: boolean;
  skippedReason?: string;
};

/**
 * Envía acuse + aviso interno. Preferir await + try/catch en el route
 * para que fallos de mail no tumben el 201/200.
 */
export async function sendIngestEmails(
  payload: IngestEmailPayload,
): Promise<SendIngestEmailsResult> {
  const client = getResendClient();
  const from = emailFromClients();
  const notifyTo = emailNotifyTo();
  const replyTo = emailReplyTo();

  if (!client) {
    console.warn("[ingest-email] RESEND_API_KEY no configurada; skip envío");
    return {
      visitorSent: false,
      notifySent: false,
      skippedReason: "no-api-key",
    };
  }

  let visitorSent = false;
  let notifySent = false;

  const common = {
    from,
    ...(replyTo ? { replyTo } : {}),
  };

  try {
    const { error } = await client.emails.send({
      ...common,
      to: payload.email,
      subject: visitorSubject(),
      text: visitorText(payload),
    });
    if (error) {
      console.error("[ingest-email] acuse visitante falló", error);
    } else {
      visitorSent = true;
    }
  } catch (e) {
    console.error("[ingest-email] acuse visitante excepción", e);
  }

  if (!notifyTo) {
    console.warn(
      "[ingest-email] EMAIL_NOTIFY_TO no configurada; skip aviso interno",
    );
  } else {
    try {
      const { error } = await client.emails.send({
        ...common,
        to: notifyTo,
        subject: notifySubject(payload.deduped),
        text: notifyText(payload),
      });
      if (error) {
        console.error("[ingest-email] aviso interno falló", error);
      } else {
        notifySent = true;
      }
    } catch (e) {
      console.error("[ingest-email] aviso interno excepción", e);
    }
  }

  return { visitorSent, notifySent };
}

/** Helpers exportados para tests de plantillas. */
export const __emailTemplates = {
  visitorSubject,
  visitorText,
  notifySubject,
  notifyText,
  excerpt,
};
