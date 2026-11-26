import type { Lead } from "@/lib/domain/lead";
import { getDuplicateLeadIds as detectDuplicateLeadIds } from "@/lib/leads/detect-duplicates";

export const WORK_QUEUE_IDS = [
  "pendiente_revisar",
  "faltan_datos",
  "followup_overdue",
  "duplicados",
] as const;

export type WorkQueueId = (typeof WORK_QUEUE_IDS)[number];

export interface WorkQueue {
  id: WorkQueueId;
  title: string;
  description: string;
  count: number;
  leadIds: string[];
  firstLeadId: string | null;
  previewNames: string[];
}

export function isWorkQueueId(value: string | null | undefined): value is WorkQueueId {
  return (
    !!value && (WORK_QUEUE_IDS as readonly string[]).includes(value)
  );
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDuplicateLeadIds(leads: Lead[]): Set<string> {
  return detectDuplicateLeadIds(leads);
}

export function matchesWorkQueue(lead: Lead, queueId: WorkQueueId, duplicateIds: Set<string>): boolean {
  switch (queueId) {
    case "pendiente_revisar":
      return lead.status === "Nuevo" || lead.status === "Pendiente revisar";
    case "faltan_datos":
      return !lead.email && !lead.phone && !lead.website;
    case "followup_overdue": {
      if (!lead.nextFollowUp) return false;
      if (lead.status === "Cliente" || lead.status === "Descartado") return false;
      return lead.nextFollowUp.slice(0, 10) < todayIsoDate();
    }
    case "duplicados":
      return duplicateIds.has(lead.id);
    default:
      return false;
  }
}

const QUEUE_META: Record<
  WorkQueueId,
  { title: string; description: string }
> = {
  pendiente_revisar: {
    title: "Nuevos y pendientes",
    description: "Estado Nuevo o Pendiente revisar (cualificar)",
  },
  faltan_datos: {
    title: "Faltan datos",
    description: "Sin correo, teléfono ni web",
  },
  followup_overdue: {
    title: "Follow-up vencido",
    description: "Próximo seguimiento anterior a hoy",
  },
  duplicados: {
    title: "Posibles duplicados",
    description: "Mismo email, teléfono, dominio o nombre/dirección similar",
  },
};

export function buildWorkQueues(leads: Lead[]): WorkQueue[] {
  const duplicateIds = getDuplicateLeadIds(leads);
  return WORK_QUEUE_IDS.map((id) => {
    const matched = leads.filter((l) => matchesWorkQueue(l, id, duplicateIds));
    return {
      id,
      title: QUEUE_META[id].title,
      description: QUEUE_META[id].description,
      count: matched.length,
      leadIds: matched.map((l) => l.id),
      firstLeadId: matched[0]?.id ?? null,
      previewNames: matched.slice(0, 3).map((l) => l.companyName),
    };
  });
}

export function getWorkQueueTitle(id: WorkQueueId): string {
  return QUEUE_META[id].title;
}
