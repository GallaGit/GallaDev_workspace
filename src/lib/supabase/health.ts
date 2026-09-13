import type { DbProvider } from "./env";

/** Semáforo de conexión de la fuente de datos activa. */
export type DbStatus = "ok" | "auth" | "config" | "down";

export interface DbHealth {
  provider: DbProvider;
  status: DbStatus;
  message: string;
  latencyMs: number;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/**
 * Clasifica un error de PostgREST/red en semáforo. Pura y testeable.
 * - auth: credenciales inválidas o RLS denegando (401/403, JWT).
 * - config: falta schema/tabla o env (PGRST205, 404 en tabla).
 * - down: red caída, timeout, 5xx.
 */
export function classifySupabaseError(error: unknown): DbStatus {
  if (!error || typeof error !== "object") return "down";
  const err = error as SupabaseErrorLike;
  const code = String(err.code ?? "").toUpperCase();
  const message = String(err.message ?? "").toLowerCase();
  const status = err.status;

  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    message.includes("jwt") ||
    message.includes("invalid api key") ||
    message.includes("unauthorized") ||
    message.includes("permission denied")
  ) {
    return "auth";
  }
  if (
    code === "PGRST205" ||
    code === "PGRST200" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  ) {
    return "config";
  }
  return "down";
}

/** Clasifica el mensaje de testIntegration("notion") en semáforo. */
export function classifyNotionMessage(ok: boolean, message: string): DbStatus {
  if (ok) return "ok";
  const m = message.toLowerCase();
  if (m.includes("falta el token") || m.includes("no configurado")) return "config";
  if (
    m.includes("401") ||
    m.includes("unauthorized") ||
    m.includes("invalid") ||
    m.includes("restricted")
  ) {
    return "auth";
  }
  return "down";
}

export function isDbStatus(value: unknown): value is DbStatus {
  return value === "ok" || value === "auth" || value === "config" || value === "down";
}
