import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthDisabled, type SessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Defensa en profundidad para route handlers (Paso 2 — Supabase Auth).
 *
 * El proxy ya protege páginas y APIs cuando el auth está activo, pero
 * cada ruta sensible verifica la sesión de forma explícita para no
 * depender de una sola capa.
 *
 * Devuelve `null` si la petición está autorizada (auth local desactivado
 * o usuario Supabase con perfil) o una respuesta 401 JSON si no lo está.
 * Sin fila en `profiles` → denegado (fail-closed: nadie opera sin rol).
 */
export async function requireApiSession(): Promise<NextResponse | null> {
  const session = await getApiSession();
  if (session) return null;
  return NextResponse.json(
    { ok: false, error: "No autorizado" },
    { status: 401 },
  );
}

/** Sesión API: usuario Supabase + rol de `profiles` (null si no autorizado). */
export async function getApiSession(
  client?: SupabaseClient,
): Promise<SessionUser | null> {
  if (isAuthDisabled()) {
    return { id: "local", email: null, role: "Admin" };
  }
  const sb = client ?? (await createSupabaseServerClient());
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? null, role: profile.role };
}
