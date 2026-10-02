import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import {
  getActiveProvider,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/env";
import {
  classifySupabaseError,
  dbStatusMessage,
  type DbHealth,
  type DbStatus,
} from "@/lib/supabase/health";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

function health(status: DbStatus, latencyMs: number): DbHealth {
  return {
    provider: getActiveProvider(),
    status,
    message: dbStatusMessage(status),
    latencyMs,
  };
}

/**
 * Conectividad de Supabase con el cliente de sesión (RLS).
 * Cualquier rol de la app puede mirar el semáforo. No usa service role
 * y no devuelve el texto de Postgres.
 */
export async function GET(): Promise<NextResponse> {
  const denied = await requireApiSession();
  if (denied) return denied;
  const started = Date.now();
  const latencyMs = () => Date.now() - started;

  if (!supabaseUrl() || !supabasePublishableKey()) {
    return NextResponse.json(health("config", latencyMs()));
  }

  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb
      .from("leads")
      .select("id", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) {
      return NextResponse.json(health(classifySupabaseError(error), latencyMs()));
    }
    return NextResponse.json(health("ok", latencyMs()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const status =
      /timeout|abort|fetch|network|econn|enotfound/i.test(message)
        ? ("down" as const)
        : classifySupabaseError(e);
    return NextResponse.json(health(status, latencyMs()));
  }
}
