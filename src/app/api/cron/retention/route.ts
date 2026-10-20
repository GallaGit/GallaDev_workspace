import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatRetentionLog,
  isAuthorizedCronRequest,
  runRetention,
} from "@/lib/retention/retention";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/cron/retention — purga de datos personales caducados (Vercel Cron).
 *
 * Auth: cabecera `Authorization: Bearer <CRON_SECRET>`; no hay sesión Supabase
 * (src/proxy.ts deja pasar la ruta). Por defecto es dry-run: la ejecución real
 * exige RETENTION_ENABLED=true y que la query no fuerce dry_run=1|true.
 * La respuesta solo lleva recuentos (nunca rutas de Storage ni PII).
 */
export async function GET(request: Request) {
  const authorized = isAuthorizedCronRequest(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const searchParam = new URL(request.url).searchParams.get("dry_run");
  const forcedDryRun = searchParam === "1" || searchParam === "true";
  const dryRun = forcedDryRun || process.env.RETENTION_ENABLED !== "true";

  try {
    const result = await runRetention(createSupabaseAdminClient(), {
      dryRun,
      bucket: process.env.EMAIL_ATTACHMENTS_BUCKET,
    });

    console.info(formatRetentionLog(result));

    const { storage_paths, ...counts } = result;
    return NextResponse.json(
      { ok: true, ...counts, storage_files: storage_paths.length },
      { headers: NO_STORE },
    );
  } catch {
    console.error("[retention] failed");
    return NextResponse.json(
      { ok: false, error: "retention_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
