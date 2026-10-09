import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchReceivingEmail } from "./receiving-fetch";
import { prepareStoredEmailBodies } from "./sanitize-email-html";

/**
 * Rellena body_html / body_text de mensajes inbound ya guardados sin cuerpo.
 * Idempotente: solo toca filas sin texto ni HTML; no reescribe cuerpos existentes.
 *
 * Urgente mientras Resend conserve los recibidos (~30 días).
 */

export interface BackfillBodiesResult {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function backfillMissingBodies(
  admin: SupabaseClient,
  options: { limit?: number } = {},
): Promise<BackfillBodiesResult> {
  const limit = clampLimit(options.limit);

  // Filas afectadas por el 401 silencioso: ambos cuerpos null.
  const { data: rows, error } = await admin
    .from("email_messages")
    .select("id, resend_email_id, body_html, body_text")
    .eq("direction", "inbound")
    .not("resend_email_id", "is", null)
    .is("body_html", null)
    .is("body_text", null)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const result: BackfillBodiesResult = {
    scanned: rows?.length ?? 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of rows ?? []) {
    const resendId = String(row.resend_email_id ?? "").trim();
    if (!resendId) {
      result.failed += 1;
      continue;
    }

    const fetched = await fetchReceivingEmail(resendId);
    if (!fetched.ok) {
      result.failed += 1;
      continue;
    }

    const prepared = prepareStoredEmailBodies(
      fetched.data.html,
      fetched.data.text,
    );

    if (!prepared.html && !prepared.text) {
      result.failed += 1;
      continue;
    }

    // Re-check: otra corrida concurrente pudo haber rellenado ya.
    const { data: current } = await admin
      .from("email_messages")
      .select("id, body_html, body_text")
      .eq("id", row.id)
      .maybeSingle();

    if (!current) {
      result.failed += 1;
      continue;
    }
    if (current.body_html != null || current.body_text != null) {
      result.skipped += 1;
      continue;
    }

    const { error: updateErr } = await admin
      .from("email_messages")
      .update({
        body_html: prepared.html,
        body_text: prepared.text,
      })
      .eq("id", row.id)
      .is("body_html", null)
      .is("body_text", null);

    if (updateErr) {
      result.failed += 1;
      continue;
    }

    result.updated += 1;
  }

  return result;
}

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}
