import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/n8n — retirada el 2026-10-10 (los leads ya no entran por n8n).
 * Responde 410 Gone sin autenticar, leer el cuerpo ni tocar el repositorio.
 * La ingesta del formulario web sigue en POST /api/ingest/lead.
 */
function gone() {
  return NextResponse.json(
    { ok: false, error: "La ingesta desde n8n está desactivada" },
    { status: 410 },
  );
}

export const POST = gone;
