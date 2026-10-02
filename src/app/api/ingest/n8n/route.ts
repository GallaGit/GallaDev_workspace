import { NextResponse } from "next/server";
import { bearerMatches, ingestSecrets, readBearer } from "@/lib/ingest/bearer";
import {
  clientIp,
  consumeRateLimit,
  readCappedJson,
} from "@/lib/rate-limit";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { visitorDeniedResponse } from "@/lib/demo/gate";
import { getPrivilegedLeadRepository } from "@/lib/repository/get-repository";
import { validateLeadCreate } from "@/lib/leads/validate-lead";
import { dispatchLeadCreated } from "@/lib/automations/dispatch";
import { errorClassOf, logRouteError, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/n8n — ingesta rica de prospectos desde n8n → GDW CRM.
 *
 * Auth: `Authorization: Bearer <N8N_INGEST_SECRET>`. Si esa variable no
 * está, se acepta `INGEST_SECRET` para no cortar un workflow ya desplegado.
 * Si ambas están y son iguales, 503. SÍ dispara dispatchLeadCreated.
 * El ingest de landing sigue sin dispatch y no acepta el secreto de n8n.
 */
const MAX_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60;
const DEFAULT_SOURCE = "n8n";

export async function POST(request: Request) {
  if (await isVisitorRequest()) return visitorDeniedResponse();
  const requestId = requestIdFrom(request);
  const { n8n: secret, n8nMisconfigured } = ingestSecrets();
  if (n8nMisconfigured || !secret) {
    logRouteError({
      route: "POST /api/ingest/n8n",
      status: 503,
      errorClass: "NotConfigured",
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "Ingesta no configurada" },
      { status: 503 },
    );
  }
  if (!bearerMatches(readBearer(request), secret)) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  if (
    await consumeRateLimit("ingest:n8n", clientIp(request), {
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo más tarde." },
      { status: 429 },
    );
  }

  const parsed = await readCappedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.status === 413 ? "Payload demasiado grande" : "JSON inválido",
      },
      { status: parsed.status },
    );
  }
  const raw: unknown = parsed.value;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { ok: false, error: "Payload inválido" },
      { status: 400 },
    );
  }

  const body = raw as Record<string, unknown>;
  if (body.source === undefined || body.source === null || body.source === "") {
    body.source = DEFAULT_SOURCE;
  }

  const result = validateLeadCreate(body);
  if (!result.ok || !result.value) {
    return NextResponse.json(
      { ok: false, error: "Datos no válidos", fieldErrors: result.errors },
      { status: 400 },
    );
  }

  try {
    const repo = getPrivilegedLeadRepository();
    const lead = await repo.create(result.value);
    const automation = dispatchLeadCreated(lead);
    return NextResponse.json(
      { ok: true, id: lead.id, automation },
      { status: 201 },
    );
  } catch (e) {
    logRouteError({
      route: "POST /api/ingest/n8n",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar el lead" },
      { status: 500 },
    );
  }
}
