/**
 * Una línea JSON en los catch de rutas API.
 * Solo datos operativos: nombre de ruta, status, clase de error y un id
 * de petición si ya venía en cabecera. Sin cuerpos, tokens ni PII.
 */

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

export function requestIdFrom(request: Request): string | undefined {
  return safeId(
    request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id"),
  );
}

export function errorClassOf(error: unknown): string {
  if (!(error instanceof Error)) return "NonError";
  const name = error.name && SAFE_CODE.test(error.name) ? error.name : "Error";
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && SAFE_CODE.test(code)) {
    return `${name}:${code}`;
  }
  return name;
}

export function logRouteError(
  fields: {
    route: string;
    status?: number;
    errorClass: string;
    requestId?: string;
    leadId?: string;
  },
  level: "error" | "warn" = "error",
): void {
  const payload: Record<string, string | number> = {
    level,
    route: fields.route,
    errorClass: fields.errorClass,
  };
  if (typeof fields.status === "number") payload.status = fields.status;
  const requestId = safeId(fields.requestId);
  const leadId = safeId(fields.leadId);
  if (requestId) payload.requestId = requestId;
  if (leadId) payload.leadId = leadId;
  const line = JSON.stringify(payload);
  if (level === "warn") console.warn(line);
  else console.error(line);
}

function safeId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const id = value.trim();
  return SAFE_ID.test(id) ? id : undefined;
}
