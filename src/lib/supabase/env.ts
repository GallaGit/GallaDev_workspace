function envValue(...keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** URL pública del proyecto Supabase. Acepta nombre con y sin prefijo NEXT_PUBLIC_. */
export function supabaseUrl(): string {
  return envValue("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
}

/** Publishable key (segura en browser). Acepta ambos nombres. */
export function supabasePublishableKey(): string {
  return envValue(
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

/** Service role / secret key. SOLO servidor, nunca exponer al browser. */
export function supabaseServiceRoleKey(): string {
  return envValue("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
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
