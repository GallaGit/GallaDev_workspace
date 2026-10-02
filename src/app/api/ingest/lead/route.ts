import { NextResponse } from "next/server";
import { bearerMatches, ingestSecrets, readBearer } from "@/lib/ingest/bearer";
import {
  INGEST_RECEIPT_KEY,
  INGEST_RECEIPT_MAX,
  INGEST_RECEIPT_NAMESPACE,
  INGEST_RECEIPT_WINDOW_MS,
  clientIp,
  consumeRateLimit,
  readCappedJson,
} from "@/lib/rate-limit";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { visitorDeniedResponse } from "@/lib/demo/gate";
import { getPrivilegedLeadRepository } from "@/lib/repository/get-repository";
import { findLocalDuplicates } from "@/lib/leads/validate-lead";
import {
  appendIngestNote,
  mapIngestToLeadCreate,
  validateIngest,
} from "@/lib/ingest/validate-ingest";
import { sendIngestEmails } from "@/lib/email/send-ingest-emails";
import { errorClassOf, logRouteError, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/lead — ingesta pública del formulario galladev.com.
 *
 * Auth: `Authorization: Bearer <INGEST_SECRET>` (no la cookie de sesión;
 * la ruta está exenta en src/proxy.ts). No acepta `N8N_INGEST_SECRET`.
 * NO dispara automatizaciones n8n por decisión de producto: solo guarda.
 * Tras create/dedupe envía emails canal clientes (fail-open).
 *
 * Rate-limit por IP (Redis si Upstash está configurado; si no, por instancia)
 * y un cupo diario de acuses que no depende de la IP.
 */
const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

async function safeSendEmails(args: {
  name: string;
  email: string;
  company: string;
  message: string;
  leadId: string;
  deduped: boolean;
  requestId?: string;
}): Promise<void> {
  const { requestId, ...payload } = args;
  const capped = await consumeRateLimit(INGEST_RECEIPT_NAMESPACE, INGEST_RECEIPT_KEY, {
    windowMs: INGEST_RECEIPT_WINDOW_MS,
    max: INGEST_RECEIPT_MAX,
  });
  if (capped) {
    logRouteError(
      {
        route: "POST /api/ingest/lead",
        errorClass: "ReceiptDailyCap",
        requestId,
      },
      "warn",
    );
    return;
  }
  try {
    await sendIngestEmails(payload);
  } catch (e) {
    logRouteError(
      {
        route: "POST /api/ingest/lead",
        errorClass: errorClassOf(e),
        requestId,
      },
      "warn",
    );
  }
}

export async function POST(request: Request) {
  if (await isVisitorRequest()) return visitorDeniedResponse();
  const requestId = requestIdFrom(request);
  const secret = ingestSecrets().form;
  if (!secret) {
    logRouteError({
      route: "POST /api/ingest/lead",
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
    await consumeRateLimit("ingest:lead", clientIp(request), {
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

  const result = validateIngest(raw as Record<string, unknown>);
  if (!result.ok || !result.value) {
    return NextResponse.json(
      { ok: false, error: "Datos no válidos", fieldErrors: result.errors },
      { status: 400 },
    );
  }

  try {
    const repo = getPrivilegedLeadRepository();

    // Fusión de duplicados: mismo email → anexar mensaje, sin fila nueva.
    const existing = await repo.list();
    const dupes = findLocalDuplicates(
      { email: result.value.email, phone: null, website: null },
      existing.map((l) => ({
        id: l.id,
        companyName: l.companyName,
        email: l.email,
        phone: l.phone,
        website: l.website,
      })),
    );
    const emailDupe = dupes.find((d) => d.reason === "mismo email");
    if (emailDupe) {
      const current = existing.find((l) => l.id === emailDupe.id);
      const merged = await repo.update(emailDupe.id, {
        notes: appendIngestNote(current?.notes ?? null, result.value.message),
      });
      await safeSendEmails({
        name: result.value.name,
        email: result.value.email,
        company: result.value.company,
        message: result.value.message,
        leadId: merged.id,
        deduped: true,
        requestId,
      });
      return NextResponse.json(
        { ok: true, id: merged.id, deduped: true },
        { status: 200 },
      );
    }

    const lead = await repo.create(mapIngestToLeadCreate(result.value));
    // Sin dispatch*: no disparamos n8n desde la landing (decisión producto).
    await safeSendEmails({
      name: result.value.name,
      email: result.value.email,
      company: result.value.company,
      message: result.value.message,
      leadId: lead.id,
      deduped: false,
      requestId,
    });
    return NextResponse.json(
      { ok: true, id: lead.id, deduped: false },
      { status: 201 },
    );
  } catch (e) {
    logRouteError({
      route: "POST /api/ingest/lead",
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
