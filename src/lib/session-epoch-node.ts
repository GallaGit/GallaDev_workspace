import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Increments the shared session epoch atomically in Supabase. */
export async function bumpSessionEpoch(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("bump_session_epoch");
  if (error) throw new Error(`No se pudo cerrar las sesiones: ${error.message}`);

  const epoch = Number(data);
  if (!Number.isSafeInteger(epoch) || epoch < 0) {
    throw new Error("Supabase devolvió un epoch de sesión inválido");
  }
  return epoch;
}
