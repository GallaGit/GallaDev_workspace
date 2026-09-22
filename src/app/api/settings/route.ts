import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import {
  getSettingsService,
  toPublicSettings,
  validateSettingsPatch,
} from "@/lib/settings";
import type { SettingsPatch } from "@/lib/settings/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  return NextResponse.json(toPublicSettings(getSettingsService().getRaw()));
}

export async function PATCH(request: Request) {
  const denied = await requireApiSession();
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
    const raw = getSettingsService().patch(patch);
    return NextResponse.json(toPublicSettings(raw));
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al guardar la configuración";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
