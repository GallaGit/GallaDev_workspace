import "server-only";

import { getApiSession } from "@/lib/api-auth";
import type { ThreadPatch } from "@/lib/email/email-payload";
import { AUDIT_SYSTEM_ACTOR, logAudit } from "./log-audit";

const SUBJECT_MAX = 80;

/** Asunto truncado: único texto del correo que se guarda. */
export function auditSubject(subject: string | null | undefined): string | null {
  const s = (subject ?? "").trim();
  return s ? s.slice(0, SUBJECT_MAX) : null;
}

export async function logEmailReceived(input: {
  threadId: string;
  messageId: string;
  subject?: string | null;
  attachmentCount?: number;
}): Promise<void> {
  await logAudit({
    actor: AUDIT_SYSTEM_ACTOR,
    action: "email.received",
    entity: "email_thread",
    entityId: input.threadId,
    diff: {
      fields: [],
      meta: {
        messageId: input.messageId,
        subject: auditSubject(input.subject),
        attachments: input.attachmentCount ?? 0,
      },
    },
  });
}

export async function logEmailReplied(input: {
  threadId: string;
  messageId?: string | null;
  leadId?: string | null;
  attachmentCount: number;
}): Promise<void> {
  const actor = await getApiSession();
  if (!actor) return;
  await logAudit({
    actor,
    action: "email.replied",
    entity: "email_thread",
    entityId: input.threadId,
    leadId: input.leadId,
    diff: {
      fields: [],
      meta: { messageId: input.messageId ?? null, attachments: input.attachmentCount },
    },
  });
}

/** Registra enlace a lead y archivado/papelera de hilos (uno por hilo). */
export async function logEmailThreadChange(
  threadIds: readonly string[],
  patch: ThreadPatch,
  leadId?: string | null,
): Promise<void> {
  const linked = patch.lead_id !== undefined;
  const stateChange =
    patch.archived !== undefined || patch.trashed !== undefined;
  if (!linked && !stateChange) return;
  const actor = await getApiSession();
  if (!actor) return;

  for (const threadId of threadIds) {
    if (linked) {
      await logAudit({
        actor,
        action: "email.linked",
        entity: "email_thread",
        entityId: threadId,
        leadId: patch.lead_id ?? leadId,
        diff: { fields: ["lead_id"], meta: { linked: patch.lead_id != null } },
      });
    }
    if (stateChange) {
      const state =
        patch.trashed !== undefined
          ? patch.trashed ? "trashed" : "restored"
          : patch.archived ? "archived" : "unarchived";
      await logAudit({
        actor,
        action: "email.archived",
        entity: "email_thread",
        entityId: threadId,
        leadId,
        diff: { fields: [patch.trashed !== undefined ? "trashed" : "archived"], meta: { state } },
      });
    }
  }
}

export async function logLeadMerged(input: {
  keepId: string;
  mergedIds: string[];
  filledKeys: readonly string[];
}): Promise<void> {
  const actor = await getApiSession();
  if (!actor) return;
  await logAudit({
    actor,
    action: "lead.merged",
    entity: "lead",
    entityId: input.keepId,
    diff: {
      fields: [...input.filledKeys].sort(),
      meta: { mergedIds: input.mergedIds },
    },
  });
}

export async function logLeadAiAnalyzed(input: {
  leadId: string;
  model: string;
  success: boolean;
}): Promise<void> {
  const actor = await getApiSession();
  if (!actor) return;
  await logAudit({
    actor,
    action: "lead.ai_analyzed",
    entity: "lead",
    entityId: input.leadId,
    diff: { fields: [], meta: { model: input.model.slice(0, 80), success: input.success } },
  });
}
