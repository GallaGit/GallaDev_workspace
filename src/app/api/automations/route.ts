import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSettingsService, toPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const settings = toPublicSettings(getSettingsService().getRaw());
  return NextResponse.json({ automations: settings.automations });
}
