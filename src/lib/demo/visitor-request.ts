import "server-only";

import { cookies } from "next/headers";
import {
  VISITOR_COOKIE,
  demoSessionSecret,
  isDemoConfigured,
} from "./config";
import { verifyVisitorToken } from "./token";

/**
 * True solo con la demo configurada y una cookie firmada vigente.
 * No abre cliente de Supabase: si `cookies()` no está en una petición,
 * no hay visitante.
 */
export async function isVisitorRequest(): Promise<boolean> {
  if (!isDemoConfigured()) return false;
  const secret = demoSessionSecret();
  if (!secret) return false;
  try {
    const jar = await cookies();
    return verifyVisitorToken(jar.get(VISITOR_COOKIE)?.value, secret);
  } catch {
    return false;
  }
}
