import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getSettingsService, toPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  const settings = toPublicSettings(getSettingsService().getRaw());
  return NextResponse.json({ automations: settings.automations });
}
