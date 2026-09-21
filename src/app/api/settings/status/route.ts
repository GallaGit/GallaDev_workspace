import { NextResponse } from "next/server";
import { getSettingsService, toPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = toPublicSettings(getSettingsService().getRaw());
    return NextResponse.json({
      ...settings,
      // Compat: Notion runtime removed; always false.
      notionConfigured: false,
      serpapiConfigured: settings.serpapi.configured,
      groqConfigured: settings.ai.configured,
      n8nActions: settings.automations.map((a) => ({
        action: a.action,
        configured: a.webhook.configured,
        enabled: a.enabled,
      })),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al leer la configuración";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
