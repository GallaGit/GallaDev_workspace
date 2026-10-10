import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { parseDraftBody } from "@/lib/email/email-payload";
import { isUuid } from "@/lib/supabase/lead-lookup";
import { EMAIL_JSON_MAX_BYTES } from "@/lib/email/limits";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DRAFT_COLUMNS =
  "id, mailbox_address, to_address, subject, body_text, lead_id, thread_id, reply_mode, created_at, updated_at";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

/**
 * GET /api/email/drafts — lista de borradores de mensaje nuevo (Admin).
 * GET /api/email/drafts?threadId=<uuid> — borrador de respuesta de ese hilo (o null).
 * POST /api/email/drafts — crear o actualizar borrador. Con `threadId`, upsert
 * del único borrador de respuesta de ese hilo.
 */
async function listDrafts(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  try {
    const supabase = await createSupabaseServerClient();
    const threadId = new URL(request.url).searchParams.get("threadId");
    if (threadId !== null) {
      if (!isUuid(threadId)) {
        return NextResponse.json(
          { ok: false, error: "Identificador no válido" },
          { status: 400 },
        );
      }
      const { data: one, error: oneErr } = await supabase
        .from("email_drafts")
        .select(DRAFT_COLUMNS)
        .eq("thread_id", threadId)
        .maybeSingle();
      if (oneErr) {
        logRouteError({
          route: "GET /api/email/drafts",
          status: 500,
          errorClass: `Supabase:${oneErr.code}`,
          requestId,
        });
        return NextResponse.json(
          { ok: false, error: "No se pudo cargar el borrador" },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, draft: one ?? null });
    }

    const { data, error } = await supabase
      .from("email_drafts")
      .select(DRAFT_COLUMNS)
      .is("thread_id", null)
      .order("updated_at", { ascending: false });

    if (error) {
      logRouteError({
        route: "GET /api/email/drafts",
        status: 500,
        errorClass: `Supabase:${error.code}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudieron cargar los borradores" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, drafts: data ?? [] });
  } catch (e) {
    logRouteError({
      route: "GET /api/email/drafts",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

async function saveDraft(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:drafts", clientIp(request), {
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
    const read = await readCappedJson(request, EMAIL_JSON_MAX_BYTES);
    if (!read.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            read.status === 413
              ? "El cuerpo es demasiado largo"
              : "Datos del correo no válidos",
        },
        { status: read.status },
      );
    }
    const parsed = parseDraftBody(read.value);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const row = {
      mailbox_address: parsed.value.mailbox,
      to_address: parsed.value.to,
      subject: parsed.value.subject,
      body_text: parsed.value.bodyText,
      lead_id: parsed.value.leadId,
      ...(parsed.value.threadId
        ? { thread_id: parsed.value.threadId, reply_mode: parsed.value.replyMode ?? "reply" }
        : {}),
    };

    let draftId = parsed.value.id;
    if (!draftId && parsed.value.threadId) {
      const { data: existing } = await supabase
        .from("email_drafts")
        .select("id")
        .eq("thread_id", parsed.value.threadId)
        .maybeSingle();
      if (existing?.id) draftId = existing.id as string;
    }

    if (draftId) {
      const { data, error } = await supabase
        .from("email_drafts")
        .update(row)
        .eq("id", draftId)
        .select(
          DRAFT_COLUMNS,
        )
        .single();

      if (error || !data) {
        logRouteError({
          route: "POST /api/email/drafts",
          status: error?.code === "PGRST116" ? 404 : 500,
          errorClass: `Supabase:${error?.code ?? "update"}`,
          requestId,
        });
        return NextResponse.json(
          { ok: false, error: "No se pudo actualizar el borrador" },
          { status: error?.code === "PGRST116" ? 404 : 500 },
        );
      }
      return NextResponse.json({ ok: true, draft: data });
    }

    const { data, error } = await supabase
      .from("email_drafts")
      .insert(row)
      .select(
        DRAFT_COLUMNS,
      )
      .single();

    if (error || !data) {
      logRouteError({
        route: "POST /api/email/drafts",
        status: 500,
        errorClass: `Supabase:${error?.code ?? "insert"}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudo guardar el borrador" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, draft: data }, { status: 201 });
  } catch (e) {
    logRouteError({
      route: "POST /api/email/drafts",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export const GET = withJsonErrors("GET /api/email/drafts", listDrafts);
export const POST = withJsonErrors("POST /api/email/drafts", saveDraft);
