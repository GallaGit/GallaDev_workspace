import { NextResponse } from "next/server";
import { getApiSession, requireAdmin } from "@/lib/api-auth";
import { isAppRole, type AppRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export interface TeamMember {
  id: string;
  email: string | null;
  /** null = cuenta autenticada pendiente de rol. */
  role: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/team — miembros del workspace para asignación de responsable
 * y de rol. Solo Admin: el listado usa service_role (bypass RLS de
 * profiles, que solo permite leer el propio perfil). Incluye cuentas
 * de Auth aún sin rol. Seller y Viewer reciben 403.
 *
 * PATCH /api/team — un Admin asigna Admin, Seller o Viewer.
 * Body: { id, role }. No puede quitarse el Admin a sí mismo.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const sb = createSupabaseAdminClient();
    const [{ data: profiles, error: profilesError }, { data: usersData, error }] =
      await Promise.all([
        sb.from("profiles").select("id, role"),
        sb.auth.admin.listUsers(),
      ]);
    if (error || profilesError) {
      return NextResponse.json(
        {
          error: `No se pudo listar el equipo: ${error?.message ?? profilesError?.message}`,
        },
        { status: 500 },
      );
    }
    const roleById = new Map(
      ((profiles ?? []) as Array<{ id: string; role: string | null }>).map((p) => [
        p.id,
        p.role ?? null,
      ]),
    );
    const seen = new Set<string>();
    const members: TeamMember[] = [];
    for (const user of usersData?.users ?? []) {
      seen.add(user.id);
      members.push({
        id: user.id,
        email: user.email ?? null,
        role: roleById.has(user.id) ? (roleById.get(user.id) ?? null) : null,
      });
    }
    for (const [id, role] of roleById) {
      if (seen.has(id)) continue;
      members.push({ id, email: null, role });
    }
    return NextResponse.json({ members });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al listar el equipo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const actor = await getApiSession();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "No autorizado", code: "unauthenticated" },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  const body = raw as { id?: unknown; role?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const role = body.role;
  if (!UUID_RE.test(id) || !isAppRole(role)) {
    return NextResponse.json(
      { error: "Indica un usuario y un rol Admin, Seller o Viewer" },
      { status: 400 },
    );
  }
  if (id === actor.id && role !== "Admin") {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de Admin" },
      { status: 400 },
    );
  }

  try {
    const sb = createSupabaseAdminClient();
    const { error } = await sb.from("profiles").upsert(
      { id, role: role satisfies AppRole },
      { onConflict: "id" },
    );
    if (error) {
      return NextResponse.json(
        { error: `No se pudo asignar el rol: ${error.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, member: { id, role } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al asignar el rol";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
