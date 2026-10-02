/** Tope de texto o HTML de correo, alineado con el corte al persistir. */
export const MAX_EMAIL_BODY_CHARS = 256 * 1024;

/** Asunto de compose, respuesta y borrador. */
export const MAX_EMAIL_SUBJECT_CHARS = 500;

/** Dirección suelta (RFC 5321, tope práctico). */
export const MAX_EMAIL_ADDRESS_CHARS = 320;

/**
 * JSON de compose, respuesta o borrador: dos cuerpos más un margen
 * para el resto de campos. Por encima, la ruta responde 413.
 */
export const EMAIL_JSON_MAX_BYTES = MAX_EMAIL_BODY_CHARS * 2 + 64 * 1024;
