const JSON_CONTENT_TYPE = /(?:application|text)\/(?:[\w.+-]+\+)?json\b/i;

function isJsonContentType(header: string | null): boolean {
  return header !== null && JSON_CONTENT_TYPE.test(header);
}

function emptyBodyMessage(status: number): string {
  return `El servidor respondió sin datos (HTTP ${status}). Inténtalo de nuevo o revisa los registros.`;
}

function unexpectedMessage(status: number): string {
  return `Sesión caducada o respuesta inesperada (HTTP ${status}). Recarga la página.`;
}

function errorField(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("error" in data)) return undefined;
  const error = (data as { error: unknown }).error;
  if (typeof error !== "string") return undefined;
  const trimmed = error.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Lee el cuerpo como texto y lo interpreta como JSON.
 * Un 500 vacío (el módulo no llegó a responder) no pasa por `res.json()`,
 * que en el navegador lanza "Unexpected end of JSON input".
 */
export async function readJsonResponse<T>(
  res: Response,
  fallbackError: string,
): Promise<T> {
  const contentType = res.headers.get("content-type");
  if (res.redirected || (contentType !== null && !isJsonContentType(contentType))) {
    throw new Error(unexpectedMessage(res.status));
  }

  const text = await res.text();
  if (text.trim() === "") {
    throw new Error(emptyBodyMessage(res.status));
  }

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new Error(emptyBodyMessage(res.status));
  }

  if (!res.ok) {
    throw new Error(errorField(data) ?? fallbackError);
  }

  return data as T;
}
