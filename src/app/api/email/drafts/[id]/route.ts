import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/email/drafts/[id] — eliminar borrador (Admin).
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("email_drafts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      logRouteError({
        route: `DELETE /api/email/drafts/${id}`,
        status: 500,
        errorClass: `Supabase:${error.code}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudo eliminar el borrador" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Borrador no encontrado o sin permiso" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logRouteError({
      route: `DELETE /api/email/drafts/${id}`,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
