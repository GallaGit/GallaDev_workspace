import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/supabase/lead-lookup";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import {
  isPreviewableContentType,
  resolveAttachmentDownload,
} from "@/lib/email/attachment-download";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

/**
 * GET /api/email/attachments/[id]
 *
 * Devuelve una URL firmada temporal de Resend para el adjunto.
 * Auth: requireAdmin + RLS. El id es el UUID de email_attachments
 * (nunca un id de Resend en la URL → evita IDOR entre correos).
 * No hace proxy del fichero.
 */
async function getAttachment(request: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "Adjunto no encontrado", reason: "not-found" },
      { status: 404 },
    );
  }

  if (
    await consumeRateLimit("email:attachment-download", clientIp(request), {
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
    const result = await resolveAttachmentDownload(supabase, id);

    if (!result.ok) {
      const map: Record<
        typeof result.reason,
        { status: number; error: string }
      > = {
        "not-found": { status: 404, error: "Adjunto no encontrado" },
        "no-resend-id": {
          status: 404,
          error: "Este adjunto no tiene referencia en Resend",
        },
        "no-client": {
          status: 503,
          error: "Resend no está configurado",
        },
        expired: {
          status: 410,
          error:
            "Resend ya no conserva este adjunto (retención ~30 días). No se puede descargar.",
        },
        "resend-error": {
          status: 502,
          error: "No se pudo obtener el adjunto de Resend",
        },
      };
      const body = map[result.reason];
      return NextResponse.json(
        { ok: false, error: body.error, reason: result.reason },
        { status: body.status },
      );
    }

    return NextResponse.json({
      ok: true,
      url: result.downloadUrl,
      expiresAt: result.expiresAt,
      filename: result.filename,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes,
      previewable: isPreviewableContentType(result.contentType),
    });
  } catch (e) {
    logRouteError({
      route: `GET /api/email/attachments/${id}`,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 },
    );
  }
}

export const GET = withJsonErrors(
  "GET /api/email/attachments/[id]",
  getAttachment,
);
