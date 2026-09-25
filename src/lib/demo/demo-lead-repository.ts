import type { Lead } from "@/lib/domain/lead";
import type { LeadRepository } from "@/lib/repository/lead-repository";
import { DEMO_LEADS, demoActivityFor } from "./seed";

/** La demo no persiste. Cualquier escritura se rechaza antes de tocar estado. */
export class DemoReadOnlyError extends Error {
  constructor() {
    super("La demo es de solo lectura");
    this.name = "DemoReadOnlyError";
  }
}

/**
 * Repositorio en memoria de solo lectura.
 * Cada lectura clona el seed: nadie muta el array compartido.
 * No importa Supabase ni abre un cliente.
 */
export class DemoLeadRepository implements LeadRepository {
  async list(): Promise<Lead[]> {
    return DEMO_LEADS.map((lead) => structuredClone(lead));
  }

  async get(id: string): Promise<Lead | null> {
    const lead = DEMO_LEADS.find((item) => item.id === id);
    return lead ? structuredClone(lead) : null;
  }

  async create(): Promise<Lead> {
    throw new DemoReadOnlyError();
  }

  async update(): Promise<Lead> {
    throw new DemoReadOnlyError();
  }

  async archive(): Promise<void> {
    throw new DemoReadOnlyError();
  }

  async appendActivity(): Promise<void> {
    throw new DemoReadOnlyError();
  }

  async getActivity(id: string) {
    return demoActivityFor(id);
  }

  async setNotesOverflow(): Promise<void> {
    throw new DemoReadOnlyError();
  }

  async getNotesOverflow(id: string): Promise<string | null> {
    const lead = DEMO_LEADS.find((item) => item.id === id);
    return lead?.notesOverflow ?? null;
  }
}

export function getDemoLeadRepository(): LeadRepository {
  return new DemoLeadRepository();
}
