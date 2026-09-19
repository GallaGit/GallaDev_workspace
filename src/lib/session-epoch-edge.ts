/** Edge-safe session epoch reader. Never import Node APIs from this module. */

const DEFAULT_EPOCH = 1;

function parseEpoch(value: unknown): number | null {
  const epoch = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null;
}

export async function getSessionEpoch(): Promise<number> {
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
    if (!response.ok) return DEFAULT_EPOCH;
    const rows = (await response.json()) as Array<{ epoch?: unknown }>;
    return parseEpoch(rows[0]?.epoch) ?? DEFAULT_EPOCH;
  } catch {
    return DEFAULT_EPOCH;
  }
}
