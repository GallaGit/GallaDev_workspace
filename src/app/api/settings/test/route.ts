import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getSettingsService, toPublicSettings } from "@/lib/settings";
import {
  isIntegrationId,
  testIntegration,
} from "@/lib/settings/test-connections";
import type { SettingsPatch } from "@/lib/settings/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      integration?: string;
      overrides?: SettingsPatch;
    };
    const integration = body.integration ?? "";
    if (!isIntegrationId(integration)) {
      return NextResponse.json(
        { error: "Integración desconocida" },
        { status: 400 },
      );
    }

    const service = getSettingsService();
    const previous = service.getRaw().connections[integration];
    const result = await testIntegration(integration, body.overrides);
    const now = new Date().toISOString();
    const connection = result.ok
      ? { status: "ok" as const, lastSyncedAt: now, lastError: null }
      : {
          status: "error" as const,
          lastSyncedAt: previous.lastSyncedAt,
          lastError: result.message,
        };
    const raw = service.setConnection(integration, connection);

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      integration,
      connection,
      settings: toPublicSettings(raw),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al probar la conexión";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
