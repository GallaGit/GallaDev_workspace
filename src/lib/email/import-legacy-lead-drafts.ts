import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultMailbox } from "./mailboxes";
import { pickLeadEmail } from "@/lib/utils/gmail-compose";

/**
 * Copia puntual de borradores antiguos en `leads.email_subject` /
 * `leads.email_body` a `email_drafts` (mensaje nuevo, un borrador por lead).
 * No modifica ni vacía las columnas del lead. Idempotente: si ya hay un
 * borrador de mensaje nuevo con ese lead_id, lo salta.
 *
 * dryRun: informa qué crearía, sin escribir.
 */

export interface ImportLegacyLeadDraftsOptions {
  dryRun?: boolean;
  /** Leads a revisar por llamada (1–500, defecto 200). */
  limit?: number;
  offset?: number;
}

export interface ImportLegacyCreated {
  leadId: string;
  draftId: string | null;
}

export interface ImportLegacyLeadDraftsResult {
  dryRun: boolean;
  scanned: number;
  created: ImportLegacyCreated[];
  skipped: number;
  /** Siguiente offset para continuar; null si no quedan filas por revisar. */
  nextOffset: number | null;
}

const MAX_LIMIT = 500;

function hasLegacyDraft(subject: unknown, body: unknown): boolean {
  const s = typeof subject === "string" ? subject.trim() : "";
  const b = typeof body === "string" ? body.trim() : "";
  return Boolean(s || b);
}

export async function importLegacyLeadDrafts(
  admin: SupabaseClient,
  opts: ImportLegacyLeadDraftsOptions = {},
): Promise<ImportLegacyLeadDraftsResult> {
  const dryRun = opts.dryRun !== false;
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 200), 1), MAX_LIMIT);
  const offset = Math.max(Math.trunc(opts.offset ?? 0), 0);

  const result: ImportLegacyLeadDraftsResult = {
    dryRun,
    scanned: 0,
    created: [],
    skipped: 0,
    nextOffset: null,
  };

  const { data: leads, error } = await admin
    .from("leads")
    .select(
      "id, email, email_commercial, email_manager, email_subject, email_body",
    )
    .or("email_subject.not.is.null,email_body.not.is.null")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const rows = leads ?? [];
  const ids = rows.map((row) => String(row.id));
  const existing = new Set<string>();
  if (ids.length > 0) {
    const { data: drafts, error: draftsError } = await admin
      .from("email_drafts")
      .select("lead_id")
      .in("lead_id", ids)
      .is("thread_id", null);
    if (draftsError) throw draftsError;
    for (const draft of drafts ?? []) {
      if (draft.lead_id) existing.add(String(draft.lead_id));
    }
  }

  const mailbox = defaultMailbox();

  for (const row of rows) {
    result.scanned += 1;
    const leadId = String(row.id);
    if (
      !hasLegacyDraft(row.email_subject, row.email_body) ||
      existing.has(leadId)
    ) {
      result.skipped += 1;
      continue;
    }
    if (dryRun) {
      result.created.push({ leadId, draftId: null });
      continue;
    }
    const { data: inserted, error: insertError } = await admin
      .from("email_drafts")
      .insert({
        mailbox_address: mailbox,
        to_address:
          pickLeadEmail({
            email: typeof row.email === "string" ? row.email : null,
            emailCommercial:
              typeof row.email_commercial === "string"
                ? row.email_commercial
                : null,
            emailManager:
              typeof row.email_manager === "string" ? row.email_manager : null,
          }) ?? "",
        subject:
          typeof row.email_subject === "string" ? row.email_subject : "",
        body_text: typeof row.email_body === "string" ? row.email_body : "",
        lead_id: leadId,
      })
      .select("id")
      .single();
    if (insertError || !inserted) throw insertError ?? new Error("insert");
    result.created.push({ leadId, draftId: String(inserted.id) });
  }

  if (rows.length === limit) {
    result.nextOffset = offset + limit;
  }
  return result;
}
