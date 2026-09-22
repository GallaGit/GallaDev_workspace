import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export interface TeamMember {
  id: string;
  email: string | null;
  role: string;
}

/**
 * GET /api/team — miembros del workspace para asignación de responsable.
 * Equipo interno pequeño: cualquier usuario autenticado ve la lista
 * (id + email + rol). Sin emails fuera del equipo: no hay signup público.
 */
export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const sb = createSupabaseAdminClient();
    const [{ data: profiles }, { data: usersData, error }] =
      await Promise.all([
        sb.from("profiles").select("id, role"),
        sb.auth.admin.listUsers(),
      ]);
    if (error) {
      return NextResponse.json(
        { error: `No se pudo listar el equipo: ${error.message}` },
        { status: 500 },
      );
    }
    const emails = new Map(
      (usersData?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );
    const members: TeamMember[] = ((profiles ?? []) as Array<{
      id: string;
      role: string;
    }>).map((p) => ({
      id: p.id,
      email: emails.get(p.id) ?? null,
      role: p.role,
    }));
    return NextResponse.json({ members });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al listar el equipo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
