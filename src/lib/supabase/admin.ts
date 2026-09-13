import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Cliente admin (service_role, bypass RLS). SOLO servidor:
 * migración Notion→Supabase y operaciones internas. Nunca importar en cliente.
 */
export function createSupabaseAdminClient() {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY no configurado (solo servidor, nunca en browser)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
