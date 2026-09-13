import "server-only";

import type { LeadRepository } from "./lead-repository";
import { getLeadRepository as getNotionLeadRepository } from "@/lib/notion/notion-lead-repository";
import { SupabaseLeadRepository } from "@/lib/supabase/supabase-lead-repository";
import { leadsDbProvider } from "@/lib/supabase/env";

let supabaseRepo: SupabaseLeadRepository | null = null;

/**
 * Factory de repositorio según LEADS_DB_PROVIDER (default: notion).
 * - notion: fuente de verdad v1 (paralelo seguro durante la migración).
 * - supabase: corta a Supabase cuando la migración esté validada.
 */
export function getLeadRepository(): LeadRepository {
  if (leadsDbProvider() === "supabase") {
    if (!supabaseRepo) supabaseRepo = new SupabaseLeadRepository();
    return supabaseRepo;
  }
  return getNotionLeadRepository();
}
