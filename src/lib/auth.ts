/**
 * Auth del workspace (Paso 2 — Supabase Auth multiusuario).
 *
 * Local (dev): AUTH_DISABLED=true omite los checks de sesión.
 * Producción: el auth está SIEMPRE activo (fail-closed).
 */

export type AppRole = "Admin" | "Seller" | "Viewer";

export interface SessionUser {
  id: string;
  email: string | null;
  role: AppRole;
}

export function isAppRole(role: unknown): role is AppRole {
  return role === "Admin" || role === "Seller" || role === "Viewer";
}

export function isAdminRole(role: AppRole): boolean {
  return role === "Admin";
}

/** Escritura de leads y análisis IA. Viewer solo lee (RLS y API). */
export function isLeadWriter(role: AppRole): boolean {
  return role === "Admin" || role === "Seller";
}

export function isAuthDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLED === "1"
  );
}
