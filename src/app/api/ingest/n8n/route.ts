import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  clientIp,
  isRateLimited,
  readCappedJson,
} from "@/lib/rate-limit";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { visitorDeniedResponse } from "@/lib/demo/gate";
import { getLeadRepository } from "@/lib/repository/get-repository";
import { validateLeadCreate } from "@/lib/leads/validate-lead";
import { dispatchLeadCreated } from "@/lib/automations/dispatch";
import { errorClassOf, logRouteError, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/n8n — ingesta rica de prospectos desde n8n → GDW CRM.
 *
 * Auth: `Authorization: Bearer <INGEST_SECRET>` (misma exención middleware
 * que /api/ingest/lead). SÍ dispara dispatchLeadCreated (Telegram / n8n).
 * El ingest de landing (/api/ingest/lead) sigue sin dispatch.
 */
const MAX_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60;
const DEFAULT_SOURCE = "n8n";

function readBearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return (match?.[1] ?? "").trim();
}

function bearerOk(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (await isVisitorRequest()) return visitorDeniedResponse();
  const requestId = requestIdFrom(request);
  const secret = process.env.INGEST_SECRET ?? "";
  if (!secret) {
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
  if (!bearerOk(readBearer(request), secret)) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  if (
    isRateLimited("ingest:n8n", clientIp(request), {
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
    const repo = getLeadRepository();
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
