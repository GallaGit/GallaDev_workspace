import { NextResponse } from "next/server";
import { getApiSession, requireLeadWriter } from "@/lib/api-auth";
import { isRateLimited } from "@/lib/rate-limit";

/**
 * Tope de análisis IA por usuario (Groq).
 * Misma primitiva que la ingesta (`isRateLimited`, ventana 60s, en memoria
 * por instancia). El cupo es más bajo porque cada llamada tiene coste.
 * `/api/leads/:id/analyze` y `/api/leads/pain-analysis` comparten el espacio
 * `ai:analyze`. La clave es el id de usuario: rotar IP no renueva el cupo.
 */
export const AI_ANALYZE_RATE_WINDOW_MS = 60 * 1000;
export const AI_ANALYZE_RATE_MAX = 10;

export async function requireAiAnalyzeAccess(): Promise<NextResponse | null> {
  const denied = await requireLeadWriter();
  if (denied) return denied;

  const session = await getApiSession();
  const actorId = session?.id ?? "anonymous";
  const limited = isRateLimited(
    "ai:analyze",
    actorId,
    { windowMs: AI_ANALYZE_RATE_WINDOW_MS, max: AI_ANALYZE_RATE_MAX },
  );
  if (!limited) return null;

  return NextResponse.json(
    {
      ok: false,
      error: "Demasiadas solicitudes. Inténtalo más tarde.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(AI_ANALYZE_RATE_WINDOW_MS / 1000)),
      },
    },
  );
}
