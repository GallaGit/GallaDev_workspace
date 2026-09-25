import type { Lead, LeadStatus, Province } from "@/lib/domain/lead";
import {
  formatPainAnalysis,
  type PainAnalysis,
} from "@/lib/ai/pain-analysis";

export interface DemoActivity {
  at: string;
  type: string;
  message: string;
}

interface SeedInput {
  n: number;
  companyName: string;
  status: LeadStatus;
  city: string;
  province: Province;
  services: string[];
  score: number;
  employees: number;
  favorite?: boolean;
  notes: string;
  manager: string;
  role: string;
  ai?: PainAnalysis;
}

const AI_LEVANTE: PainAnalysis = {
  evidence: [
    "La web de ejemplo menciona hojas de cálculo para el cierre mensual.",
    "El equipo publicado es de 6 personas y no cita un portal de cliente.",
  ],
  inference: [
    "El cuello de botella probable está en conciliar facturas a mano.",
    "Un recordatorio de modelos podría reducir llamadas en campaña de IVA.",
  ],
  speculation: [
    "Podrían valorar un tablero de plazos si el socio sigue en el detalle.",
  ],
};

const AI_TURIA: PainAnalysis = {
  evidence: [
    "La ficha ficticia dice que el laboral se lleva en un despacho externo.",
  ],
  inference: [
    "Unificar nóminas y fiscal en un solo seguimiento ahorraría correos.",
  ],
  speculation: [
    "Si crecen por encima de 15 empleados, el outsourcing se les quedará corto.",
  ],
};

const AI_CENTRO: PainAnalysis = {
  evidence: [
    "Las notas de la demo indican que la reunión ya está en el calendario ficticio.",
  ],
  inference: [
    "El siguiente paso es enseñar el flujo de revisión, no volver a cualificar.",
  ],
  speculation: [
    "Un piloto de dos semanas bastaría para decidir si contratan.",
  ],
};

const ROWS: SeedInput[] = [
  row(1, "Asesoría Ejemplo Levante", "Nuevo", "Valencia", "Valencia", ["Fiscal", "Contable"], 61, 4, "Llega del formulario de ejemplo. Aún no hay llamada.", "Nuria Ejemplo", "Socia"),
  row(2, "Gestoría Ejemplo del Turia", "Pendiente revisar", "Valencia", "Valencia", ["Laboral", "Fiscal"], 74, 6, "Web de ejemplo sin portal de cliente.", "Marc Ejemplo", "Gerente", true, AI_TURIA),
  row(3, "Fiscal Ejemplo Albufera", "Validado", "Catarroja", "Valencia", ["Fiscal"], 82, 3, "Datos mínimos completos. Listo para un borrador.", "Elena Ejemplo", "Directora", false, AI_LEVANTE),
  row(4, "Laboral Ejemplo Ruzafa", "Email preparado", "Valencia", "Valencia", ["Laboral"], 70, 9, "Borrador de primer contacto ya escrito en la ficha.", "Pau Ejemplo", "Responsable laboral"),
  row(5, "Contable Ejemplo Campanar", "Email enviado", "Valencia", "Valencia", ["Contable", "Fiscal"], 66, 5, "El correo de la demo figura como enviado el lunes.", "Laia Ejemplo", "Administradora"),
  row(6, "Jurídica Ejemplo Carmen", "Respondió", "Valencia", "Valencia", ["Jurídico", "Mercantil"], 88, 7, "Respondió que quieren ver cómo se priorizan los plazos.", "Hugo Ejemplo", "Abogado"),
  row(7, "Mercantil Ejemplo Centro", "Reunión", "Valencia", "Valencia", ["Mercantil", "Fiscal"], 91, 11, "Reunión ficticia anotada para el jueves.", "Sara Ejemplo", "Socia directora", true, AI_CENTRO),
  row(8, "Gestoría Ejemplo Malvarrosa", "Cliente", "Valencia", "Valencia", ["Gestoría", "Fiscal", "Laboral"], 95, 14, "Cliente de la historia de ejemplo. No existe fuera de la demo.", "Iker Ejemplo", "Director"),
  row(9, "Asesoría Ejemplo Patraix", "Descartado", "Valencia", "Valencia", ["Contable"], 22, 2, "Descartada en la demo: solo lleva familiares y no busca herramienta.", "Rita Ejemplo", "Autónoma"),
  row(10, "Asesoría Ejemplo Alicante Sur", "Nuevo", "Alicante", "Alicante", ["Fiscal", "Gestoría"], 58, 8, "Captada en un listado ficticio de la provincia.", "Nora Ejemplo", "Socia"),
  row(11, "Gestoría Ejemplo Benidorm", "Pendiente revisar", "Benidorm", "Alicante", ["Laboral", "Contable"], 63, 12, "Muchos empleados de temporada en la ficha de ejemplo.", "Pol Ejemplo", "Gerente"),
  row(12, "Fiscal Ejemplo Elche", "Validado", "Elche", "Alicante", ["Fiscal"], 77, 5, "Teléfono y correo de ejemplo comprobados a mano.", "Aina Ejemplo", "Asesora fiscal"),
  row(13, "Laboral Ejemplo Alcoy", "Email preparado", "Alcoy", "Alicante", ["Laboral"], 69, 6, "Asunto del correo ya redactado para la demo.", "Biel Ejemplo", "Graduado social"),
  row(14, "Contable Ejemplo Dénia", "Email enviado", "Dénia", "Alicante", ["Contable"], 64, 4, "Seguimiento previsto dentro de cinco días.", "Clàudia Ejemplo", "Contable"),
  row(15, "Jurídica Ejemplo Orihuela", "Respondió", "Orihuela", "Alicante", ["Jurídico"], 84, 3, "Pidió una propuesta corta, sin compromiso.", "Jan Ejemplo", "Socio"),
  row(16, "Mercantil Ejemplo Castellón", "Reunión", "Castellón de la Plana", "Castellón", ["Mercantil"], 86, 10, "Quieren ver el tablero antes de decidir.", "Ona Ejemplo", "Socia"),
  row(17, "Gestoría Ejemplo Vila-real", "Cliente", "Vila-real", "Castellón", ["Gestoría", "Contable"], 93, 16, "Segundo cliente de la historia. Sigue siendo ficticio.", "Nil Ejemplo", "Director"),
  row(18, "Asesoría Ejemplo Oropesa", "Descartado", "Oropesa del Mar", "Castellón", ["Fiscal"], 18, 1, "Cerró el despacho según la nota de ejemplo.", "Eva Ejemplo", "Titular"),
  row(19, "Nóminas Ejemplo Sagunto", "Nuevo", "Sagunto", "Valencia", ["Laboral"], 55, 7, "Especializada en nómina. Aún sin revisión.", "Roger Ejemplo", "Responsable"),
  row(20, "Herencias Ejemplo Burriana", "Pendiente revisar", "Burriana", "Castellón", ["Jurídico", "Fiscal"], 60, 3, "Casos de herencias en la descripción de la web de ejemplo.", "Marta Ejemplo", "Abogada"),
];

function row(
  n: number,
  companyName: string,
  status: LeadStatus,
  city: string,
  province: Province,
  services: string[],
  score: number,
  employees: number,
  notes: string,
  manager: string,
  role: string,
  favorite = false,
  ai?: PainAnalysis,
): SeedInput {
  return {
    n,
    companyName,
    status,
    city,
    province,
    services,
    score,
    employees,
    notes,
    manager,
    role,
    favorite,
    ai,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLead(input: SeedInput): Lead {
  const id = `demo-${pad(input.n)}`;
  const day = String(input.n).padStart(2, "0");
  const createdAt = `2026-09-${day}T09:00:00.000Z`;
  const slug = `demo-${pad(input.n)}`;
  return {
    id,
    url: `https://${slug}.example.com`,
    companyName: input.companyName,
    website: `https://${slug}.example.com`,
    email: `${slug}@example.com`,
    emailCommercial: `hola@${slug}.example.com`,
    emailManager: null,
    phone: `+34 600 000 ${String(100 + input.n)}`,
    address: `Calle Ficticia ${input.n}`,
    postalCode: "46000",
    city: input.city,
    cityCanonical: input.city,
    province: input.province,
    employees: input.employees,
    linkedin: null,
    services: input.services,
    status: input.status,
    lastActivity: createdAt,
    createdAt,
    discoveredAt: createdAt,
    notes: input.notes,
    notesOverflow: null,
    emailSubject:
      input.status === "Email preparado" || input.status === "Email enviado"
        ? `Hola ${input.companyName}`
        : null,
    emailBody:
      input.status === "Email preparado" || input.status === "Email enviado"
        ? "Texto de ejemplo para la demo. No se envía a nadie."
        : null,
    score: input.score,
    manager: input.manager,
    role: input.role,
    confidence: input.score >= 80 ? "Alta" : input.score >= 50 ? "Media" : "Baja",
    software: null,
    source: "demo",
    lastContact: input.status === "Email enviado" ? createdAt : null,
    nextFollowUp: input.status === "Email enviado" ? "2026-09-30" : null,
    favorite: input.favorite === true,
    aiAnalysis: input.ai ? formatPainAnalysis(input.ai) : null,
    lastEditedTime: createdAt,
    archived: false,
    responsibleId: null,
  };
}

export const DEMO_LEADS: readonly Lead[] = ROWS.map(toLead);

const ACTIVITY: Record<string, DemoActivity[]> = {
  "demo-02": [
    {
      at: "2026-09-02T09:30:00.000Z",
      type: "ai_analyzed",
      message: "Análisis de ejemplo guardado en la ficha (no hay llamada a un modelo).",
    },
  ],
  "demo-03": [
    {
      at: "2026-09-03T09:30:00.000Z",
      type: "ai_analyzed",
      message: "Análisis de ejemplo guardado en la ficha (no hay llamada a un modelo).",
    },
  ],
  "demo-07": [
    {
      at: "2026-09-07T11:00:00.000Z",
      type: "note",
      message: "Reunión ficticia anotada en el calendario de la demo.",
    },
    {
      at: "2026-09-07T09:30:00.000Z",
      type: "ai_analyzed",
      message: "Análisis de ejemplo guardado en la ficha (no hay llamada a un modelo).",
    },
  ],
};

export function demoActivityFor(id: string): DemoActivity[] {
  return ACTIVITY[id]?.map((event) => ({ ...event })) ?? [];
}
