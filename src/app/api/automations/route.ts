import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getSettingsService, toPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const settings = toPublicSettings(getSettingsService().getRaw());
  return NextResponse.json({ automations: settings.automations });
}
