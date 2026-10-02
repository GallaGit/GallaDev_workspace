import { randomBytes } from "node:crypto";

const MIN_LENGTH = 16;

/**
 * Secreto de la demo solo para el proceso de Playwright.
 * Si `DEMO_SESSION_SECRET` ya viene del entorno (secret de CI) y mide
 * al menos 16 caracteres, se usa ese. Si no, se genera uno que no vale
 * para producción: cambia en cada arranque y lleva el prefijo `ci-e2e-only-`.
 */
export function e2eDemoSessionSecret(
  fromEnv: string | undefined = process.env.DEMO_SESSION_SECRET,
): string {
  const value = typeof fromEnv === "string" ? fromEnv.trim() : "";
  if (value.length >= MIN_LENGTH) return value;
  return `ci-e2e-only-${randomBytes(24).toString("hex")}`;
}
