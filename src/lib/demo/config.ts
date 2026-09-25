/**
 * Modo visitante (demo sin cuenta).
 *
 * `DEMO_MODE_ENABLED` se lee en runtime (acceso dinámico) para poder
 * apagarlo en el entorno sin un cambio de código. Si no está definido,
 * o no es "true" / "1", la demo está apagada.
 *
 * Con la demo encendida hace falta `DEMO_SESSION_SECRET` (≥ 16 caracteres)
 * para firmar la cookie. Sin secreto, la entrada queda cerrada.
 */

export const VISITOR_COOKIE = "gdw_visitor";

/** Unas horas: suficiente para una revisión, corto si la cookie se filtra. */
export const VISITOR_TTL_SECONDS = 4 * 60 * 60;

const MIN_SECRET_LENGTH = 16;

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Encendido solo con `true` o `1`. Cualquier otro valor, incluido vacío, es off. */
export function isDemoModeEnabled(): boolean {
  const raw = readEnv("DEMO_MODE_ENABLED").toLowerCase();
  return raw === "true" || raw === "1";
}

/** Secreto HMAC. Null si falta o es demasiado corto. */
export function demoSessionSecret(): string | null {
  const secret = readEnv("DEMO_SESSION_SECRET");
  if (secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

/** La UI y POST /api/demo/enter solo se ofrecen cuando flag y secreto están listos. */
export function isDemoConfigured(): boolean {
  return isDemoModeEnabled() && demoSessionSecret() !== null;
}
