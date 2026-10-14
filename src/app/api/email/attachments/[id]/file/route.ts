import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/supabase/lead-lookup";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { resolveAttachmentDownload } from "@/lib/email/attachment-download";
import {
  contentDisposition,
  fetchTrustedUpstream,
  isInlineContentType,
  safeResponseContentType,
} from "@/lib/email/attachment-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

const ERRORS = {
  "not-found": { status: 404, error: "Adjunto no encontrado" },
  "no-resend-id": { status: 404, error: "Este adjunto no tiene referencia en Resend" },
  "no-client": { status: 503, error: "Resend no está configurado" },
  expired: {
    status: 410,
    error: "Resend ya no conserva este adjunto (retención ~30 días). No se puede descargar.",
  },
  "resend-error": { status: 502, error: "No se pudo obtener el adjunto de Resend" },
  "untrusted-url": { status: 502, error: "Resend devolvió una URL de descarga no válida" },
} as const;

function errorResponse(reason: keyof typeof ERRORS) {
  const body = ERRORS[reason];
  return NextResponse.json(
    { ok: false, error: body.error, reason },
    { status: body.status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * GET /api/email/attachments/[id]/file
 *
 * Proxy en streaming del fichero (mismo origen). Mismas comprobaciones que
 * /api/email/attachments/[id]: requireAdmin + RLS + rate limit. La URL
 * firmada de Resend nunca llega al navegador.
 */
async function getAttachmentFile(request: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;

  if (!isUuid(id)) return errorResponse("not-found");

  if (
    await consumeRateLimit("email:attachment-download", clientIp(request), {
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
    })
  ) {
    return NextResponse.json({ ok: false, error: "Demasiadas solicitudes" }, { status: 429 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const result = await resolveAttachmentDownload(supabase, id);
    if (!result.ok) return errorResponse(result.reason);

    const upstream = await fetchTrustedUpstream(result.downloadUrl);
    if (!upstream.ok) {
      logRouteError(
        {
          route: `GET /api/email/attachments/${id}/file`,
          errorClass: `AttachmentProxy:${upstream.reason}`,
          requestId,
        },
        "warn",
      );
      return errorResponse(upstream.reason);
    }

    const inline = isInlineContentType(result.contentType);
    const headers = new Headers({
      "Content-Type": safeResponseContentType(result.contentType),
      "Content-Disposition": contentDisposition(result.filename, inline),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    });
    const len = upstream.response.headers.get("content-length");
    if (len && /^\d+$/.test(len)) headers.set("Content-Length", len);

    return new Response(upstream.response.body, { status: 200, headers });
  } catch (e) {
    logRouteError({
      route: `GET /api/email/attachments/${id}/file`,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export const GET = withJsonErrors("GET /api/email/attachments/[id]/file", getAttachmentFile);
