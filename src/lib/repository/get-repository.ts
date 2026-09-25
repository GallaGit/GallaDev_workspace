import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadRepository } from "./lead-repository";
import { isAuthDisabled } from "@/lib/auth";
import { getDemoLeadRepository } from "@/lib/demo/demo-lead-repository";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { SupabaseLeadRepository } from "@/lib/supabase/supabase-lead-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type DbProvider } from "@/lib/supabase/env";

export type { DbProvider };
export { getActiveProvider } from "@/lib/supabase/env";

let supabaseRepo: SupabaseLeadRepository | null = null;

/**
 * Factory de repositorio. Supabase es la única fuente de verdad;
 * el runtime Notion se eliminó.
 *
 * Sin cliente: singleton con service_role (ingesta pública, health y
 * contextos sin usuario — bypass RLS documentado).
 * Con cliente de sesión: instancia por petición; RLS aplica por rol.
 */
export function getLeadRepository(client?: SupabaseClient): LeadRepository {
  if (client) return new SupabaseLeadRepository(client);
  if (!supabaseRepo) supabaseRepo = new SupabaseLeadRepository();
  return supabaseRepo;
}

/**
 * Repositorio con la sesión Supabase de la petición (RLS por rol).
 * Usar en todas las rutas con usuario; nunca en ingesta pública.
 *
 * Con AUTH_DISABLED (solo dev local): service_role, coherente con
 * "sin login". Si se usara el cliente de sesión sin JWT, RLS devolvería
 * 0 filas en silencio. Para probar RLS real: AUTH_DISABLED=false.
 */
export async function getSessionLeadRepository(): Promise<LeadRepository> {
  // Visitante primero: ni service_role ni cliente de sesión.
  if (await isVisitorRequest()) return getDemoLeadRepository();
  if (isAuthDisabled()) return getLeadRepository();
  return getLeadRepository(await createSupabaseServerClient());
}
