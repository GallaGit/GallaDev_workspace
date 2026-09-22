import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getAutomationClient } from "@/lib/automations/get-client";
import { N8nClientError } from "@/lib/n8n/errors";
import { sampleAutomationPayload } from "@/lib/n8n/payloads";
import {
  getSettingsService,
  resolveAutomationAction,
  toPublicSettings,
  validateSettingsPatch,
} from "@/lib/settings";
import type { SettingsPatch } from "@/lib/settings/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ action: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { action: rawAction } = await ctx.params;
  const action = resolveAutomationAction(rawAction);
  if (!action) {
    return NextResponse.json({ error: "Acción desconocida" }, { status: 404 });
  }
  const settings = toPublicSettings(getSettingsService().getRaw());
  const item = settings.automations.find((a) => a.action === action);
  return NextResponse.json({ automation: item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const { action: rawAction } = await ctx.params;
    const action = resolveAutomationAction(rawAction);
    if (!action) {
      return NextResponse.json({ error: "Acción desconocida" }, { status: 404 });
    }
    const body = (await request.json()) as {
      enabled?: boolean;
      webhookUrl?: string;
    };
    const patch: SettingsPatch = {
      automations: {
        [action]: {
          enabled: body.enabled,
          webhookUrl: body.webhookUrl,
        },
      },
    };
    const errors = validateSettingsPatch(patch);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: "Datos no válidos", fieldErrors: errors },
        { status: 400 },
      );
    }
    const raw = getSettingsService().patch(patch);
    const settings = toPublicSettings(raw);
    return NextResponse.json({
      automation: settings.automations.find((a) => a.action === action),
      settings,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al guardar la automatización";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const { action: rawAction } = await ctx.params;
    const action = resolveAutomationAction(rawAction);
    if (!action) {
      return NextResponse.json({ error: "Acción desconocida" }, { status: 404 });
    }

    const payload = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const isTest = payload.test === true || payload.test === "true";
    const body = isTest
      ? sampleAutomationPayload(action)
      : (payload.payload as Record<string, unknown> | undefined) ?? payload;

    const result = await getAutomationClient().triggerWebhook(action, body);

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    if (e instanceof N8nClientError) {
      const status =
        e.code === "not_configured" ? 400 : e.code === "timeout" ? 504 : 502;
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status },
      );
    }
    const message = e instanceof Error ? e.message : "Error n8n";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
