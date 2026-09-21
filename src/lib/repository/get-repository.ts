import "server-only";

import type { LeadRepository } from "./lead-repository";
import { SupabaseLeadRepository } from "@/lib/supabase/supabase-lead-repository";
import { type DbProvider } from "@/lib/supabase/env";

export type { DbProvider };
export { getActiveProvider } from "@/lib/supabase/env";

let supabaseRepo: SupabaseLeadRepository | null = null;

/**
 * Factory de repositorio. Supabase es la única fuente de verdad;
 * el runtime Notion se eliminó.
 */
export function getLeadRepository(): LeadRepository {
  if (!supabaseRepo) supabaseRepo = new SupabaseLeadRepository();
  return supabaseRepo;
}
