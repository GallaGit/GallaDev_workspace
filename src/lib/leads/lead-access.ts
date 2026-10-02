import type { AppRole } from "@/lib/auth";

/**
 * Predicado de acceso a un lead. Es el mismo que las policies RLS
 * (migración least-privilege): Admin lee y escribe todo, incluido lo
 * sin responsable; Seller solo si `responsable` es su id; Viewer lee
 * toda la cartera (rol de confianza de solo lectura, spec de producto)
 * y no escribe.
 *
 * No hay rol manager. Un lead sin responsable lo ve y lo asigna un Admin.
 * Viewer también lo lee. Seller no.
 */
export interface LeadActor {
  id: string;
  role: AppRole;
}

export interface LeadAssignment {
  responsibleId: string | null;
}

export function canReadLead(actor: LeadActor, lead: LeadAssignment): boolean {
  if (actor.role === "Admin" || actor.role === "Viewer") return true;
  if (actor.role === "Seller") return lead.responsibleId === actor.id;
  return false;
}

export function canWriteLead(actor: LeadActor, lead: LeadAssignment): boolean {
  if (actor.role === "Admin") return true;
  if (actor.role === "Seller") return lead.responsibleId === actor.id;
  return false;
}

/**
 * Cambio de responsable. Admin puede dejar el lead sin asignar o
 * pasarlo a otra persona. Seller solo puede dejarlo asignado a sí mismo
 * (no devolverlo a la cola común).
 */
export function assignmentAllowed(
  actor: LeadActor,
  nextResponsibleId: string | null,
): boolean {
  if (actor.role === "Admin") return true;
  if (actor.role === "Seller") return nextResponsibleId === actor.id;
  return false;
}
