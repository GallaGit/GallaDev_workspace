import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getApiSession, requireAdmin, requireCorreoAccess } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { COMPANY_MAILBOXES, isCompanyMailbox } from "@/lib/email/mailboxes";
import { parseSignatureText } from "@/lib/email/signature";
import { isUuid } from "@/lib/supabase/lead-lookup";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const BODY_MAX_BYTES = 16 * 1024;

/**
 * GET /api/email/signatures — firma de cada buzón: { signatures: { [mailbox]: string } }.
 * PUT /api/email/signatures — { mailbox, signature } guarda (o vacía) la firma de un buzón.
 * Auth: GET Admin o Seller (requireCorreoAccess); PUT solo Admin.
 * RLS: lectura Admin/Seller; escritura de firmas solo Admin.
 */
async function listSignatures(request: Request) {
  const denied = await requireCorreoAccess();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("email_mailbox_signatures")
      .select("mailbox_address, signature");

    if (error) {
      logRouteError({
        route: "GET /api/email/signatures",
        status: 500,
        errorClass: `Supabase:${error.code}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudieron cargar las firmas" },
        { status: 500 },
      );
    }

    const signatures: Record<string, string> = Object.fromEntries(
      COMPANY_MAILBOXES.map((mailbox) => [mailbox, ""]),
    );
    for (const row of data ?? []) {
      const mailbox = String(row.mailbox_address ?? "");
      if (isCompanyMailbox(mailbox)) {
        signatures[mailbox] = typeof row.signature === "string" ? row.signature : "";
      }
    }
    return NextResponse.json({ ok: true, signatures });
  } catch (e) {
    logRouteError({
      route: "GET /api/email/signatures",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

async function saveSignature(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:signatures", clientIp(request), {
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes" },
      { status: 429 },
    );
  }

  try {
    const read = await readCappedJson(request, BODY_MAX_BYTES);
    if (!read.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: read.status === 413 ? "La firma es demasiado larga" : "Datos no válidos",
        },
        { status: read.status },
      );
    }
    const raw = read.value;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ ok: false, error: "Datos no válidos" }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    if (Object.keys(body).some((key) => key !== "mailbox" && key !== "signature")) {
      return NextResponse.json({ ok: false, error: "Campo no permitido" }, { status: 400 });
    }
    const mailbox = typeof body.mailbox === "string" ? body.mailbox.trim().toLowerCase() : "";
    if (!isCompanyMailbox(mailbox)) {
      return NextResponse.json(
        { ok: false, error: "Buzón de origen no válido" },
        { status: 400 },
      );
    }
    const signature = parseSignatureText(body.signature);
    if (!signature.ok) {
      return NextResponse.json({ ok: false, error: signature.error }, { status: 400 });
    }

    const session = await getApiSession();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("email_mailbox_signatures").upsert(
      {
        mailbox_address: mailbox,
        signature: signature.value,
        ...(session && isUuid(session.id) ? { updated_by: session.id } : {}),
      },
      { onConflict: "mailbox_address" },
    );

    if (error) {
      logRouteError({
        route: "PUT /api/email/signatures",
        status: 500,
        errorClass: `Supabase:${error.code}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudo guardar la firma" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, mailbox, signature: signature.value });
  } catch (e) {
    logRouteError({
      route: "PUT /api/email/signatures",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export const GET = withJsonErrors("GET /api/email/signatures", listSignatures);
export const PUT = withJsonErrors("PUT /api/email/signatures", saveSignature);
