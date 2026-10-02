import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadRepository } from "./lead-repository";
import { isAuthDisabled } from "@/lib/auth";
import { getDemoLeadRepository } from "@/lib/demo/demo-lead-repository";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseLeadRepository } from "@/lib/supabase/supabase-lead-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type DbProvider } from "@/lib/supabase/env";

export type { DbProvider };
export { getActiveProvider } from "@/lib/supabase/env";

let privilegedRepo: SupabaseLeadRepository | null = null;

/**
 * Repositorio con el cliente que pase el llamador. RLS si es el de sesión.
 * No hay cliente por defecto: un route handler nuevo no hereda service role.
 */
export function getLeadRepository(client: SupabaseClient): LeadRepository {
  return new SupabaseLeadRepository(client);
}

/**
 * Service role. Solo ingesta pública (bearer) y el modo local AUTH_DISABLED.
 * El nombre deja el bypass a la vista en el review.
 */
export function getPrivilegedLeadRepository(): LeadRepository {
  if (!privilegedRepo) {
    privilegedRepo = new SupabaseLeadRepository(createSupabaseAdminClient());
  }
  return privilegedRepo;
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
  if (isAuthDisabled()) return getPrivilegedLeadRepository();
  return getLeadRepository(await createSupabaseServerClient());
}
