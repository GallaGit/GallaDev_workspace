import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit/log-audit";

export const dynamic = "force-dynamic";

/**
 * Registra el cierre de sesión en el historial. El navegador la llama
 * antes de `auth.signOut()` porque después ya no hay sesión que atribuir.
 * No cierra la sesión: eso lo hace el navegador (local o global).
 * Sin sesión válida responde 200 igualmente (cerrar sesión es idempotente).
 */
export async function POST() {
  try {
    const actor = await getApiSession();
    if (actor) {
      await logAudit({
        actor,
        action: "auth.logout",
        entity: "session",
        entityId: actor.id,
        changedFields: [],
      });
    }
  } catch {
    // El cierre de sesión del navegador sigue adelante.
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
