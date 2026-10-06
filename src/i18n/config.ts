export const locales = ["es", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "es";

/** Cookie name for the active UI locale (no URL prefix). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "es" || value === "en";
}
