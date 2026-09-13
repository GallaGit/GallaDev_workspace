/**
 * Migración Notion → Supabase (Fase 1 v2.0).
 *
 * Lee leads directo de la API de Notion (activos + archivados + bloques
 * Actividad/Notas) y hace upsert en public.leads / public.lead_activities.
 *
 * Uso:
 *   npx tsx scripts/migrate-notion-to-supabase.mts            # dry-run (no escribe)
 *   npx tsx scripts/migrate-notion-to-supabase.mts --live     # escribe en Supabase
 *   npx tsx scripts/migrate-notion-to-supabase.mts --live --limit 5
 *   npx tsx scripts/migrate-notion-to-supabase.mts --live --lead <notion-page-id>
 *
 * Env (.env.local, nunca commitear):
 *   NOTION_TOKEN, NOTION_DATA_SOURCE_ID,
 *   SUPABASE_URL (+ SUPABASE_SECRET_KEY solo servidor para --live)
 *
 * Notas:
 * - El uuid de Supabase se deriva del page id de Notion (mismo hex con
 *   guiones 8-4-4-4-12) para que los deep-links /leads?lead=<id> sigan
 *   funcionando tras el cutover. notion_page_id guarda el id original.
 * - Re-ejecutable: upsert por notion_page_id + recrea actividades del lote.
 * - Notion no se toca (solo lectura).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "@notionhq/client";
import { createClient } from "@supabase/supabase-js";
import { mapNotionPageToLead } from "../src/lib/notion/mapper";
import { normalizeStatus, type Lead } from "../src/lib/domain/lead";
import { splitNotes } from "../src/lib/utils/email-plain";

// ---------------------------------------------------------------- env
function loadDotEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} no configurado en .env.local`);
  return value;
}

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 0 : 0;
const leadIdx = args.indexOf("--lead");
const ONLY_LEAD = leadIdx >= 0 ? (args[leadIdx + 1] ?? "").replace(/-/g, "") : "";

// ---------------------------------------------------------------- notion
type AnyBlock = { id: string; type?: string; [k: string]: unknown };

function blockPlain(block: AnyBlock): string {
  const type = block.type;
  if (!type) return "";
  const inner = block[type] as { rich_text?: { plain_text: string }[] } | undefined;
  return inner?.rich_text?.map((r) => r.plain_text).join("") ?? "";
}

async function listAllBlocks(
  notion: Client,
  pageId: string,
): Promise<AnyBlock[]> {
  const blocks: AnyBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const b of res.results) blocks.push(b as unknown as AnyBlock);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

function parseBlocks(blocks: AnyBlock[]): {
  activities: { at: string; type: string; message: string }[];
  notesOverflow: string | null;
} {
  const activities: { at: string; type: string; message: string }[] = [];
  const notesParts: string[] = [];
  let section: "none" | "activity" | "notes" = "none";
  for (const b of blocks) {
    const text = blockPlain(b);
    if (b.type === "heading_2" && text === "Actividad") {
      section = "activity";
      continue;
    }
    if (b.type === "heading_2" && text === "Notas") {
      section = "notes";
      continue;
    }
    if (b.type === "heading_2") {
      section = "none";
      continue;
    }
    if (b.type !== "paragraph" || !text) continue;
    if (section === "activity") {
      const m = text.match(/^\[([^\]]+)\]\s*\(([^)]+)\)\s*(.*)$/);
      if (m) activities.push({ at: m[1], type: m[2], message: m[3] });
      else activities.push({ at: "", type: "event", message: text });
    } else if (section === "notes") {
      notesParts.push(text);
    }
  }
  const notesOverflow = notesParts.join("\n") || null;
  return { activities, notesOverflow };
}

async function queryPages(
  notion: Client,
  dataSourceId: string,
  inTrash: boolean,
): Promise<unknown[]> {
  const results: unknown[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      ...(inTrash ? { in_trash: true as const } : {}),
    });
    results.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return results;
}

// ---------------------------------------------------------------- main
function hyphenateToUuid(id: string): string {
  const hex = id.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`Page id inválido: ${id}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const toDateOnly = (v: string | null): string | null =>
  v && v.length >= 10 ? v.slice(0, 10) : v;

async function main(): Promise<void> {
  loadDotEnvLocal();
  console.log(`Modo: ${LIVE ? "LIVE (escribe en Supabase)" : "DRY-RUN (solo lectura)"}`);

  const notion = new Client({ auth: required("NOTION_TOKEN") });
  const dataSourceId = required("NOTION_DATA_SOURCE_ID").replace(/-/g, "");

  // 1. Leer Notion (activos + papelera para archivados).
  // Nota: la API de Notion (v2025-09-03, @notionhq/client 5.x) rechaza el
  // parámetro in_trash en dataSources.query (ni true ni false). Si la papelera
  // no es enumerable, se migra solo activos y se avisa.
  const activePages = await queryPages(notion, dataSourceId, false);
  let trashedPages: unknown[] = [];
  try {
    trashedPages = await queryPages(notion, dataSourceId, true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("in_trash")) {
      console.warn(
        "AVISO: la API de Notion no permite enumerar la papelera (in_trash rechazado). " +
          "Se migran solo leads activos. Para archivados: restaura temporalmente o exporta CSV.",
      );
    } else {
      throw e;
    }
  }
  const byId = new Map<string, unknown>();
  for (const p of [...activePages, ...trashedPages]) {
    const id = (p as { id?: string }).id;
    if (id) byId.set(id.replace(/-/g, ""), p);
  }
  let pages = [...byId.values()];
  if (ONLY_LEAD) pages = pages.filter((p) => (p as { id: string }).id.replace(/-/g, "") === ONLY_LEAD);
  if (LIMIT > 0) pages = pages.slice(0, LIMIT);
  console.log(`Notion: ${activePages.length} activas + ${trashedPages.length} en papelera → ${byId.size} únicas, lote=${pages.length}`);

  // 2. Mapear + bloques
  const leads: Lead[] = [];
  const activitiesByLead = new Map<string, { at: string; type: string; message: string }[]>();
  const overflowByLead = new Map<string, string | null>();
  let i = 0;
  for (const page of pages) {
    const lead = mapNotionPageToLead(page);
    if (!lead) continue;
    const blocks = await listAllBlocks(notion, (page as { id: string }).id);
    const { activities, notesOverflow } = parseBlocks(blocks);
    leads.push(lead);
    activitiesByLead.set(lead.id, activities);
    overflowByLead.set(lead.id, notesOverflow);
    i++;
    if (i % 25 === 0) console.log(`  …${i}/${pages.length} páginas leídas`);
  }

  const byStatus = new Map<string, number>();
  let archived = 0;
  for (const l of leads) {
    byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);
    if (l.archived) archived++;
  }
  console.log("Notion por estado:", Object.fromEntries(byStatus), `archivados=${archived}`);

  // 3. Transformar a filas Supabase
  const rows = leads.map((l) => {
    const pageId = l.id.replace(/-/g, "");
    return {
      id: hyphenateToUuid(l.id),
      notion_page_id: pageId,
      company_name: l.companyName,
      website: l.website,
      email: l.email,
      email_commercial: l.emailCommercial,
      email_manager: l.emailManager,
      phone: l.phone,
      address: l.address,
      postal_code: l.postalCode,
      city: l.city,
      city_canonical: l.cityCanonical,
      province: l.province,
      employees: l.employees,
      linkedin: l.linkedin,
      services: l.services,
      status: normalizeStatus(l.status),
      last_activity: toDateOnly(l.lastActivity),
      discovered_at: l.discoveredAt,
      notes: l.notes,
      notes_overflow: overflowByLead.get(l.id) ?? null,
      email_subject: l.emailSubject,
      email_body: l.emailBody || null,
      score: l.score,
      manager: l.manager,
      role: l.role,
      confidence: l.confidence,
      software: l.software,
      source: l.source,
      last_contact: toDateOnly(l.lastContact),
      next_follow_up: toDateOnly(l.nextFollowUp),
      favorite: l.favorite,
      ai_analysis: l.aiAnalysis,
      url: l.url || null,
      notion_last_edited_time: l.lastEditedTime,
      archived: l.archived,
      tags: [],
      responsable: null,
    };
  });

  // Coherencia notas: si Observaciones > 2000, partir (misma regla que la app)
  for (const r of rows) {
    if (r.notes && r.notes.length > 2000) {
      const { observaciones, overflow } = splitNotes(r.notes);
      r.notes = observaciones;
      r.notes_overflow = [r.notes_overflow, overflow].filter(Boolean).join("\n") || null;
    }
  }

  if (!LIVE) {
    console.log(`DRY-RUN OK: ${rows.length} filas listas (ejemplo: ${rows[0]?.company_name ?? "—"}). Re-ejecuta con --live para escribir.`);
    return;
  }

  // 4. Escribir en Supabase (service_role, bypass RLS)
  const url = required("SUPABASE_URL");
  const serviceKey = required("SUPABASE_SECRET_KEY");
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const BATCH = 200;
  for (let s = 0; s < rows.length; s += BATCH) {
    const chunk = rows.slice(s, s + BATCH);
    const { error } = await sb.from("leads").upsert(chunk, { onConflict: "notion_page_id" });
    if (error) throw new Error(`upsert leads: ${error.message}`);
    console.log(`  leads ${Math.min(s + BATCH, rows.length)}/${rows.length}`);
  }

  // Actividades: recrear las del lote (idempotente).
  // activitiesByLead usa el page id de Notion con guiones; notion_page_id va sin guiones.
  const fixedActivityRows = rows.flatMap((r) => {
    const notionId = r.notion_page_id;
    const withDashes = `${notionId.slice(0, 8)}-${notionId.slice(8, 12)}-${notionId.slice(12, 16)}-${notionId.slice(16, 20)}-${notionId.slice(20)}`;
    const list =
      activitiesByLead.get(withDashes) ?? activitiesByLead.get(notionId) ?? [];
    return list.map((a) => ({
      lead_id: r.id,
      at: a.at || new Date().toISOString(),
      type: a.type,
      message: a.message.slice(0, 2000),
    }));
  });

  const leadIds = rows.map((r) => r.id);
  if (ONLY_LEAD || LIMIT > 0) {
    // En lotes parciales, solo recrear actividades de esos leads
    const { error } = await sb.from("lead_activities").delete().in("lead_id", leadIds);
    if (error) throw new Error(`delete activities: ${error.message}`);
  } else {
    // Migración completa: recrear todo es seguro porque el lote es el 100%
    const { error } = await sb.from("lead_activities").delete().neq("lead_id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`delete activities: ${error.message}`);
  }
  console.log(`activities: ${fixedActivityRows.length} insertadas`);
  const ABATCH = 500;
  for (let s = 0; s < fixedActivityRows.length; s += ABATCH) {
    const { error } = await sb.from("lead_activities").insert(fixedActivityRows.slice(s, s + ABATCH));
    if (error) throw new Error(`insert activities: ${error.message}`);
  }
  console.log(`activities: ${fixedActivityRows.length} insertadas`);

  // 5. Validación: conteos Supabase vs Notion
  const { data: statusCounts, error: cErr } = await sb.from("leads").select("status");
  if (cErr) throw new Error(`count: ${cErr.message}`);
  const sbByStatus = new Map<string, number>();
  for (const r of statusCounts as { status: string }[]) {
    sbByStatus.set(r.status, (sbByStatus.get(r.status) ?? 0) + 1);
  }
  const { count: sbArchived, error: aErr } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("archived", true);
  if (aErr) throw new Error(`count archived: ${aErr.message}`);
  console.log("Supabase por estado:", Object.fromEntries(sbByStatus), `archivados=${sbArchived}`);

  let ok = true;
  if (!ONLY_LEAD && LIMIT === 0) {
    // Ejecución completa: los conteos deben cuadrar exactos (upsert idempotente).
    for (const [status, n] of byStatus) {
      const got = sbByStatus.get(status) ?? 0;
      if (got !== n) {
        console.error(`MISMATCH estado ${status}: notion=${n} supabase=${got}`);
        ok = false;
      }
    }
    if ((sbArchived ?? 0) !== archived) {
      console.error(`MISMATCH archivados: notion=${archived} supabase=${sbArchived}`);
      ok = false;
    }
  } else {
    console.log("Lote parcial: validación exacta omitida (usa ejecución completa para validar).");
  }
  if (!ok) {
    console.error("VALIDACIÓN FALLIDA: revisa los conteos.");
    process.exit(1);
  }
  console.log("VALIDACIÓN OK: migración consistente.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
