/**
 * Edge-safe session epoch reader. Never import Node APIs from this module.
 *
 * Fail-closed por diseño: si Supabase está configurado pero el epoch no se
 * puede leer, devuelve `null` y los tokens se rechazan. Aceptar tokens sin
 * poder comprobar el epoch haría que logout-all pareciera funcionar (200)
 * sin invalidar nada. Solo cuando no hay backend configurado (dev sin
 * Supabase) se usa DEFAULT_EPOCH.
 */

const DEFAULT_EPOCH = 1;

function parseEpoch(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const epoch = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null;
}

export async function getSessionEpoch(): Promise<number | null> {
  const envEpoch = parseEpoch(process.env.SESSION_EPOCH);
  if (envEpoch !== null) return envEpoch;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_EPOCH;

  try {
    const response = await fetch(
      `${url}/rest/v1/app_session_epoch?id=eq.singleton&select=epoch`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.warn("[session-epoch] lectura fallida", { status: response.status });
      return null;
    }
    const rows = (await response.json()) as Array<{ epoch?: unknown }>;
    const epoch = parseEpoch(rows[0]?.epoch);
    if (epoch === null) {
      console.warn("[session-epoch] epoch inválido en Supabase");
    }
    return epoch;
  } catch (error) {
    console.warn("[session-epoch] Supabase inalcanzable", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
