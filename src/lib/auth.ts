/**
 * Auth del workspace (M1 — GEM_ROADMAP 1.5).
 *
 * Local (dev): AUTH_DISABLED=true omite los checks de sesión.
 * Producción: el auth está SIEMPRE activo (fail-closed). Sin AUTH_SECRET
 * el login responde 503 en vez de abrir la app sin protección.
 */

export function isAuthDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.AUTH_DISABLED === "true" ||
    process.env.AUTH_DISABLED === "1" ||
    !process.env.AUTH_SECRET
  );
}

export interface SessionUser {
  id: string;
  name: string;
}

/** Placeholder for future credentials login. */
export async function getSession(): Promise<SessionUser | null> {
  if (isAuthDisabled()) {
    return { id: "local", name: "Local" };
  }
  // Future: read cookie / verify JWT
  return null;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
