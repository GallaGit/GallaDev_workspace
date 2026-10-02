/**
 * Cupo de POST /api/auth/login.
 * Por IP de plataforma y por cuenta, ventana de 15 minutos.
 * `consumeRateLimit` usa Upstash si está configurado; si no, memoria.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_IP = 20;
export const LOGIN_MAX_PER_ACCOUNT = 10;

export const LOGIN_IP_NAMESPACE = "auth:login:ip";
export const LOGIN_ACCOUNT_NAMESPACE = "auth:login:account";

/** Mismo texto para contraseña incorrecta, correo no confirmado y cuenta ausente. */
export const LOGIN_GENERIC_ERROR = "Credenciales incorrectas";

export const LOGIN_RATE_ERROR = "Demasiados intentos. Prueba más tarde.";

export const LOGIN_CONFIG_ERROR = "Supabase no está configurado.";

export const LOGIN_NETWORK_ERROR = "Error de red. Inténtalo de nuevo.";
