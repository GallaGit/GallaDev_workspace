/**
 * Lectura de env de Supabase.
 *
 * En el browser Next/Turbopack solo inyecta `process.env.NEXT_PUBLIC_*` si el
 * acceso es estático (no `process.env[key]`). Por eso las claves públicas se
 * leen con literales; el resto queda para código solo-servidor.
 */

function trim(value: string | undefined): string {
  return value?.trim() || "";
}

/** URL pública del proyecto Supabase. Acepta nombre con y sin prefijo NEXT_PUBLIC_. */
export function supabaseUrl(): string {
  return (
    trim(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    trim(process.env.SUPABASE_URL)
  );
}

/** Publishable key (segura en browser). Acepta ambos nombres. */
export function supabasePublishableKey(): string {
  return (
    trim(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    trim(process.env.SUPABASE_PUBLISHABLE_KEY)
  );
}

/** Service role / secret key. SOLO servidor, nunca exponer al browser. */
export function supabaseServiceRoleKey(): string {
  return (
    trim(process.env.SUPABASE_SECRET_KEY) ||
    trim(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/** Fuente de verdad de leads: siempre Supabase (Notion runtime eliminado). */
export type DbProvider = "supabase";

export function leadsDbProvider(): DbProvider {
  return "supabase";
}

/** Alias para UI/diagnóstico. */
export function getActiveProvider(): DbProvider {
  return leadsDbProvider();
}
