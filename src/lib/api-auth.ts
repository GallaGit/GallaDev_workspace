import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthDisabled, type SessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UNAUTHENTICATED = {
  ok: false as const,
  error: "No autorizado",
  code: "unauthenticated" as const,
};

const NO_PROFILE = {
  ok: false as const,
  error:
    "Tu usuario está autenticado pero no tiene un perfil asignado. Contacta al administrador.",
  code: "no_profile" as const,
};

type SessionResolution =
  | { status: "ok"; user: SessionUser }
  | { status: "unauthenticated" }
  | { status: "no_profile" };

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
  const resolved = await resolveApiSession();
  if (resolved.status === "ok") return null;
  if (resolved.status === "no_profile") {
    return NextResponse.json(NO_PROFILE, { status: 401 });
  }
  return NextResponse.json(UNAUTHENTICATED, { status: 401 });
}

/** Sesión API: usuario Supabase + rol de `profiles` (null si no autorizado). */
export async function getApiSession(
  client?: SupabaseClient,
): Promise<SessionUser | null> {
  const resolved = await resolveApiSession(client);
  return resolved.status === "ok" ? resolved.user : null;
}

async function resolveApiSession(
  client?: SupabaseClient,
): Promise<SessionResolution> {
  if (isAuthDisabled()) {
    return { status: "ok", user: { id: "local", email: null, role: "Admin" } };
  }
  const sb = client ?? (await createSupabaseServerClient());
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { status: "unauthenticated" };
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { status: "no_profile" };
  return {
    status: "ok",
    user: { id: user.id, email: user.email ?? null, role: profile.role },
  };
}
