import { NextResponse } from "next/server";
import {
  getIntakeSettings,
  patchIntakeSettings,
  validateIntakePatch,
  type IntakeSettingsPatch,
} from "@/lib/intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/settings/intake — fila cruda + estado efectivo (auth vía middleware). */
export async function GET() {
  try {
    const settings = await getIntakeSettings();
    return NextResponse.json(settings);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al leer captación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/settings/intake — guardar open/paused + mensaje + reopensAt. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as IntakeSettingsPatch;
    const errors = validateIntakePatch(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: "Datos de captación no válidos", fieldErrors: errors },
        { status: 400 },
      );
    }
    const settings = await patchIntakeSettings(body);
    return NextResponse.json(settings);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al guardar captación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
