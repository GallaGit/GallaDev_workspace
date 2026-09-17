import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Lead,
  type LeadCreateInput,
  type LeadPatch,
} from "@/lib/domain/lead";
import type { LeadRepository } from "@/lib/repository/lead-repository";
import { splitNotes } from "@/lib/utils/email-plain";
import { createSupabaseAdminClient } from "./admin";
import {
  leadCreateToRow,
  leadPatchToRow,
  mapRowToLead,
  type LeadRow,
} from "./mappers";

export interface ActivityEvent {
  at: string;
  type: string;
  message: string;
}

/**
 * SupabaseLeadRepository — misma interfaz que NotionLeadRepository.
 * Fase 1 usa el cliente admin (service_role) porque la app corre con
 * AUTH_DISABLED=true (un solo usuario, secretos solo en servidor).
 * Fase 2 cambiará a cliente por sesión para que RLS aplique por rol.
 */
export class SupabaseLeadRepository implements LeadRepository {
  private sb: SupabaseClient;

  constructor(sb?: SupabaseClient) {
    this.sb = sb ?? createSupabaseAdminClient();
  }

  async list(options?: { includeArchived?: boolean }): Promise<Lead[]> {
    // Paginación PostgREST (límite 1000/fila por defecto): iterar hasta agotar.
    const includeArchived = Boolean(options?.includeArchived);
    const leads: Lead[] = [];
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      let query = this.sb
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false, nullsFirst: false })
        .range(from, from + pageSize - 1);
      if (!includeArchived) query = query.eq("archived", false);
      const { data, error } = await query;
      if (error) throw new Error(`Supabase list: ${error.message}`);
      const rows = (data ?? []) as LeadRow[];
      leads.push(...rows.map(mapRowToLead));
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return leads;
  }

  async get(id: string): Promise<Lead | null> {
    // Acepta uuid Supabase o page id de Notion (compatibilidad deep-links tras migrar).
    const { data, error } = await this.sb
      .from("leads")
      .select("*")
      .or(`id.eq.${id},notion_page_id.eq.${id}`)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase get: ${error.message}`);
    return data ? mapRowToLead(data as LeadRow) : null;
  }

  async create(input: LeadCreateInput): Promise<Lead> {
    const notesValue = input.notes ?? "";
    const { observaciones, overflow } = splitNotes(notesValue);
    const notesOverflow = overflow || input.notesOverflow || null;
    const { data, error } = await this.sb
      .from("leads")
      .insert({
        ...leadCreateToRow({ ...input, notes: observaciones }),
        notes_overflow: notesOverflow,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Supabase create: ${error.message}`);
    const lead = mapRowToLead(data as LeadRow);
    const src = input.source?.trim() ?? "";
    const createMsg =
      src === "web-galladev"
        ? "Lead recibido desde galladev.com"
        : src === "n8n"
          ? "Lead recibido desde n8n"
          : "Lead creado manualmente";
    await this.appendActivity(lead.id, createMsg, "create");
    return lead;
  }

  async update(id: string, patch: LeadPatch): Promise<Lead> {
    let working: LeadPatch = { ...patch };
    if (working.notes !== undefined) {
      const { observaciones, overflow } = splitNotes(working.notes ?? "");
      working = { ...working, notes: observaciones };
      const { error } = await this.sb
        .from("leads")
        .update({ notes_overflow: overflow })
        .eq("id", id);
      if (error) throw new Error(`Supabase update notes: ${error.message}`);
    }
    const { data, error } = await this.sb
      .from("leads")
      .update(leadPatchToRow(working))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`Supabase update: ${error.message}`);

    if (patch.status !== undefined) {
      await this.appendActivity(id, `Estado → ${patch.status}`, "status_changed");
    } else if (patch.notes !== undefined) {
      await this.appendActivity(id, "Notas actualizadas", "note_updated");
    } else if (patch.favorite !== undefined) {
      await this.appendActivity(
        id,
        patch.favorite ? "Marcado como favorito" : "Quitado de favoritos",
        "favorite",
      );
    } else if (
      patch.emailBody !== undefined ||
      patch.emailSubject !== undefined
    ) {
      await this.appendActivity(id, "Email editado", "email_edited");
    } else if (patch.aiAnalysis !== undefined) {
      await this.appendActivity(
        id,
        "Análisis IA de dolores actualizado",
        "ai_analyzed",
      );
    }
    return mapRowToLead(data as LeadRow);
  }

  async archive(id: string): Promise<void> {
    await this.appendActivity(id, "Lead archivado", "archived");
    const { error } = await this.sb
      .from("leads")
      .update({ archived: true })
      .eq("id", id);
    if (error) throw new Error(`Supabase archive: ${error.message}`);
  }

  async appendActivity(
    id: string,
    message: string,
    type = "event",
  ): Promise<void> {
    const { error } = await this.sb.from("lead_activities").insert({
      lead_id: id,
      at: new Date().toISOString(),
      type,
      message: message.slice(0, 2000),
    });
    if (error) throw new Error(`Supabase appendActivity: ${error.message}`);
  }

  async getActivity(id: string): Promise<ActivityEvent[]> {
    const { data, error } = await this.sb
      .from("lead_activities")
      .select("at,type,message")
      .eq("lead_id", id)
      .order("at", { ascending: false });
    if (error) throw new Error(`Supabase getActivity: ${error.message}`);
    return (data ?? []) as ActivityEvent[];
  }

  async setNotesOverflow(id: string, overflow: string | null): Promise<void> {
    const { error } = await this.sb
      .from("leads")
      .update({ notes_overflow: overflow })
      .eq("id", id);
    if (error) throw new Error(`Supabase setNotesOverflow: ${error.message}`);
  }

  async getNotesOverflow(id: string): Promise<string | null> {
    const { data, error } = await this.sb
      .from("leads")
      .select("notes_overflow")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getNotesOverflow: ${error.message}`);
    const value = (data as { notes_overflow: string | null } | null)
      ?.notes_overflow;
    return value || null;
  }
}
