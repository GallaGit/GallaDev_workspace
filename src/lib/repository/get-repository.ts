import "server-only";

import type { LeadRepository } from "./lead-repository";
import { getLeadRepository as getNotionLeadRepository } from "@/lib/notion/notion-lead-repository";
import { SupabaseLeadRepository } from "@/lib/supabase/supabase-lead-repository";
import { leadsDbProvider, type DbProvider } from "@/lib/supabase/env";

export type { DbProvider };
export { getActiveProvider } from "@/lib/supabase/env";

let supabaseRepo: SupabaseLeadRepository | null = null;

/**
 * Factory de repositorio según LEADS_DB_PROVIDER (default: supabase).
 * - supabase: fuente de verdad actual.
 * - notion: legado (solo si LEADS_DB_PROVIDER=notion explícito).
 */
export function getLeadRepository(): LeadRepository {
  if (leadsDbProvider() === "supabase") {
    if (!supabaseRepo) supabaseRepo = new SupabaseLeadRepository();
    return supabaseRepo;
  }
  return getNotionLeadRepository();
}
