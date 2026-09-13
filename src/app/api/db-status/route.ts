import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/repository/get-repository";
import {
  supabasePublishableKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "@/lib/supabase/env";
import {
  classifyNotionMessage,
  classifySupabaseError,
  type DbHealth,
} from "@/lib/supabase/health";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { testIntegration } from "@/lib/settings/test-connections";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

/** Health check barato de la fuente activa. No expone secretos ni datos. */
export async function GET(): Promise<NextResponse> {
  const provider = getActiveProvider();
  const started = Date.now();
  const latencyMs = () => Date.now() - started;

  if (provider === "supabase") {
    if (!supabaseUrl() || !supabasePublishableKey() || !supabaseServiceRoleKey()) {
      const body: DbHealth = {
        provider,
        status: "config",
        message: "Faltan SUPABASE_URL / KEYS en el servidor",
        latencyMs: latencyMs(),
      };
      return NextResponse.json(body);
    }
    try {
      const sb = createSupabaseAdminClient();
      const { error } = await sb
        .from("leads")
        .select("id", { count: "exact", head: true })
        .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
      if (error) {
        const status = classifySupabaseError(error);
        const body: DbHealth = {
          provider,
          status,
          message:
            status === "config"
              ? "Schema sin aplicar: ejecuta supabase/migrations/*_init_leads.sql"
              : `Supabase: ${error.message}`,
          latencyMs: latencyMs(),
        };
        return NextResponse.json(body);
      }
      const body: DbHealth = {
        provider,
        status: "ok",
        message: "Supabase conectado",
        latencyMs: latencyMs(),
      };
      return NextResponse.json(body);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error de red";
      const status =
        /timeout|abort|fetch|network|econn|enotfound/i.test(message)
          ? ("down" as const)
          : classifySupabaseError(e);
      const body: DbHealth = { provider, status, message: `Supabase: ${message}`, latencyMs: latencyMs() };
      return NextResponse.json(body);
    }
  }

  // provider === "notion": reutiliza el test de integración existente.
  try {
    const result = await testIntegration("notion");
    const body: DbHealth = {
      provider,
      status: classifyNotionMessage(result.ok, result.message),
      message: result.ok ? "Notion conectado" : `Notion: ${result.message}`,
      latencyMs: latencyMs(),
    };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error de red";
    const body: DbHealth = {
      provider,
      status: "down",
      message: `Notion: ${message}`,
      latencyMs: latencyMs(),
    };
    return NextResponse.json(body);
  }
}
