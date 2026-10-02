import { NextResponse } from "next/server";
import { getApiSession, requireAdmin } from "@/lib/api-auth";
import { logConfigChange } from "@/lib/route-log";
import {
  getSettingsService,
  toPublicSettings,
  validateSettingsPatch,
} from "@/lib/settings";
import { webhookAuditChanges } from "@/lib/settings/audit";
import type { SettingsPatch } from "@/lib/settings/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(toPublicSettings(getSettingsService().getRaw()));
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const patch = (await request.json()) as SettingsPatch;
    const errors = validateSettingsPatch(patch);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: "Datos de configuración no válidos", fieldErrors: errors },
        { status: 400 },
      );
    }
    const service = getSettingsService();
    const before = service.getRaw();
    const raw = service.patch(patch);
    const actor = await getApiSession();
    logConfigChange(actor?.id ?? "unknown", webhookAuditChanges(before, raw));
    return NextResponse.json(toPublicSettings(raw));
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al guardar la configuración";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
