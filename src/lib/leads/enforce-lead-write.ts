import "server-only";

import type { LeadPatch } from "@/lib/domain/lead";
import { getApiSession } from "@/lib/api-auth";
import type { LeadRepository } from "@/lib/repository/lead-repository";
import {
  assignmentAllowed,
  canReadLead,
  canWriteLead,
  type LeadAssignment,
} from "./lead-access";

type WriteGate =
  | { ok: true; patch: LeadPatch }
  | { ok: false; status: 401 | 403 | 404; error: string };

const NOT_FOUND = {
  ok: false as const,
  status: 404 as const,
  error: "Lead no encontrado",
};

/**
 * Comprueba la escritura con el mismo predicado que RLS.
 * Admin pasa sin releer la fila (puede crear y reasignar la cola).
 * Seller tiene que ser el responsable actual y no puede dejar el
 * campo vacío ni apuntarlo a otra persona. Así el paso a Cliente,
 * el archivo y el resto de parches comparten la regla.
 */
export async function constrainLeadPatch(
  repo: Pick<LeadRepository, "get">,
  id: string,
  patch: LeadPatch,
): Promise<WriteGate> {
  const actor = await getApiSession();
  if (!actor) {
    return { ok: false, status: 401, error: "No autorizado" };
  }
  if (actor.role === "Admin") {
    return { ok: true, patch };
  }
  if (actor.role !== "Seller") {
    return {
      ok: false,
      status: 403,
      error: "No tienes permiso para realizar esta acción",
    };
  }
  if (
    patch.responsibleId !== undefined &&
    !assignmentAllowed(actor, patch.responsibleId)
  ) {
    return {
      ok: false,
      status: 403,
      error: "No puedes dejar un lead sin responsable ni asignarlo a otra persona",
    };
  }
  const existing = await repo.get(id);
  if (!existing || !canWriteLead(actor, existing)) return NOT_FOUND;
  return { ok: true, patch };
}

/** Lectura: sin actor (demo) se deja la lista; con actor se aplica el predicado. */
export async function filterReadableLeads<T extends LeadAssignment>(
  leads: T[],
): Promise<T[]> {
  const actor = await getApiSession();
  if (!actor) return leads;
  return leads.filter((lead) => canReadLead(actor, lead));
}

/** Escritura masiva (score): sin actor no se toca ninguna fila. */
export async function filterWritableLeads<T extends LeadAssignment>(
  leads: T[],
): Promise<T[]> {
  const actor = await getApiSession();
  if (!actor) return [];
  return leads.filter((lead) => canWriteLead(actor, lead));
}
