import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { isCompanyMailbox, defaultMailbox } from "@/lib/email/mailboxes";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

/**
 * GET /api/email/drafts — lista de borradores (Admin).
 * POST /api/email/drafts — crear o actualizar borrador.
 */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("email_drafts")
      .select(
        "id, mailbox_address, to_address, subject, body_text, lead_id, created_at, updated_at",
      )
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

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    isRateLimited("email:drafts", clientIp(request), {
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
    const supabase = await createSupabaseServerClient();
    const body = (await request.json()) as Record<string, unknown>;

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const rawMailbox =
      typeof body.mailbox === "string" ? body.mailbox.trim().toLowerCase() : "";
    const mailbox = isCompanyMailbox(rawMailbox) ? rawMailbox : defaultMailbox();
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const bodyText = typeof body.bodyText === "string" ? body.bodyText : "";
    const leadId =
      typeof body.leadId === "string" && body.leadId.trim()
        ? body.leadId.trim()
        : null;

    const row = {
      mailbox_address: mailbox,
      to_address: to,
      subject,
      body_text: bodyText,
      lead_id: leadId,
    };

    if (id) {
      const { data, error } = await supabase
        .from("email_drafts")
        .update(row)
        .eq("id", id)
        .select(
          "id, mailbox_address, to_address, subject, body_text, lead_id, created_at, updated_at",
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
        "id, mailbox_address, to_address, subject, body_text, lead_id, created_at, updated_at",
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
