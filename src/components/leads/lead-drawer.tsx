"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  ExternalLink,
  Link2,
  MapPin,
  Mail,
  Phone,
  Copy,
  Star,
  Trash2,
  ScanSearch,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailEditor } from "@/components/leads/email-editor";
import { AiAnalysisPanel } from "@/components/leads/ai-analysis-panel";
import { resolvePainAnalysis } from "@/lib/ai/pain-analysis";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/domain/lead";
import {
  OBSERVACIONES_SOFT_LIMIT,
  combineNotes,
} from "@/lib/utils/email-plain";
import { pickLeadEmail } from "@/lib/utils/gmail-compose";
import { statusColor, useUiStore } from "@/store/ui-store";
import { toastAutomationDispatch } from "@/components/automations/toast-dispatch";

function isGenericNetworkError(message: string): boolean {
  return /failed to fetch|network|timeout|aborterror/i.test(message);
}

type AnalyzeResponse = {
  error?: unknown;
  code?: unknown;
  lead?: Lead;
  analysis?: unknown;
  activity?: { at: string; type: string; message: string }[];
  empty?: boolean;
  notionUpdated?: boolean;
  automation?: Parameters<typeof toastAutomationDispatch>[0];
};

function analyzeErrorMessage(data: {
  error?: unknown;
  code?: unknown;
}): string {
  if (data.error && typeof data.error === "object") {
    const err = data.error as { message?: unknown; code?: unknown };
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }
  }
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return "Error al analizar";
}

function copy(text: string, label: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
}

export function LeadDrawer() {
  const {
    selectedLeadId,
    setSelectedLeadId,
    leads,
    upsertLead,
    removeLead,
  } = useUiStore();

  if (!selectedLeadId) return null;

  return (
    <LeadDrawerBody
      key={selectedLeadId}
      selectedLeadId={selectedLeadId}
      setSelectedLeadId={setSelectedLeadId}
      leads={leads}
      upsertLead={upsertLead}
      removeLead={removeLead}
    />
  );
}

function LeadDrawerBody({
  selectedLeadId,
  setSelectedLeadId,
  leads,
  upsertLead,
  removeLead,
}: {
  selectedLeadId: string;
  setSelectedLeadId: (id: string | null) => void;
  leads: Lead[];
  upsertLead: (lead: Lead) => void;
  removeLead: (id: string) => void;
}) {
  const base = leads.find((l) => l.id === selectedLeadId) ?? null;
  const [lead, setLead] = useState<Lead | null>(base);
  const [notes, setNotes] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [activity, setActivity] = useState<
    { at: string; type: string; message: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeEmpty, setAnalyzeEmpty] = useState(false);
  const [apiAnalysis, setApiAnalysis] = useState<unknown>(null);
  const doloresRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${selectedLeadId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        if (cancelled) return;
        setLead(data.lead);
        setNotes(
          combineNotes(data.lead.notes, data.lead.notesOverflow),
        );
        setEmailSubject(data.lead.emailSubject ?? "");
        setEmailBody(data.lead.emailBody ?? "");
        setActivity(data.activity ?? []);
        setApiAnalysis(null);
        setAnalyzeEmpty(false);
        setAnalyzeError(null);
        upsertLead(data.lead);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeadId, upsertLead]);

  async function savePatch(patch: Partial<Lead>) {
    if (!lead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setLead(data.lead);
      upsertLead(data.lead);
      toast.success("Guardado");
      toastAutomationDispatch(data.automation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function detectPains(force = false) {
    if (!lead || analyzing || loading) return;
    const previous = lead;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeEmpty(false);
    requestAnimationFrame(() => {
      doloresRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const res = await fetch(`/api/leads/${previous.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok) {
        const message = analyzeErrorMessage(data);
        setAnalyzeError(message);
        setLead(previous);
        if (isGenericNetworkError(message)) {
          toast.error("No se pudo detectar dolores.");
        }
        return;
      }
      if (data.lead) {
        setLead(data.lead);
        upsertLead(data.lead);
      }
      setApiAnalysis(data.analysis ?? null);
      if (Array.isArray(data.activity)) {
        setActivity(data.activity);
      } else if (data.lead?.id) {
        void refreshActivity(data.lead.id);
      }
      const resolved = resolvePainAnalysis(
        data.analysis,
        data.lead?.aiAnalysis ?? previous.aiAnalysis,
      );
      if (data.empty || !resolved) {
        setAnalyzeEmpty(true);
        return;
      }
      setAnalyzeEmpty(false);
      if (data.notionUpdated) {
        toast.success("Análisis guardado");
      }
      toastAutomationDispatch(data.automation);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Error al detectar dolores";
      setAnalyzeError(message);
      setLead(previous);
      if (isGenericNetworkError(message)) {
        toast.error("No se pudo detectar dolores.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function refreshActivity(id: string) {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = (await res.json()) as { activity?: typeof activity };
      if (res.ok && Array.isArray(data.activity)) {
        setActivity(data.activity);
      }
    } catch {
      // best-effort
    }
  }

  async function archive() {
    if (!lead) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al archivar");
      removeLead(lead.id);
      setConfirmArchive(false);
      toast.success("Lead archivado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  const mapsUrl = lead?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`
    : null;

  return (
    <>
      <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-border bg-(--panel)">
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <span className="truncate text-sm font-semibold">
            {lead?.companyName ?? "Lead"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedLeadId(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {lead ? (
          <div className="flex shrink-0 flex-wrap gap-1 border-b border-(--border) px-3 py-2">
            {lead.website && (
              <Action href={lead.website} icon={ExternalLink} tip="Web" />
            )}
            {lead.linkedin && (
              <Action href={lead.linkedin} icon={Link2} tip="LinkedIn" />
            )}
            {mapsUrl && (
              <Action href={mapsUrl} icon={MapPin} tip="Google Maps" />
            )}
            {lead.email && (
              <Action href={`mailto:${lead.email}`} icon={Mail} tip="Email" />
            )}
            {lead.email && (
              <Button
                variant="outline"
                size="icon"
                title="Copiar email"
                onClick={() => copy(lead.email!, "Email")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {lead.phone && (
              <Button
                variant="outline"
                size="icon"
                title="Copiar teléfono"
                onClick={() => copy(lead.phone!, "Teléfono")}
              >
                <Phone className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              title="Favorito"
              onClick={() => savePatch({ favorite: !lead.favorite })}
            >
              <Star
                className={`h-3.5 w-3.5 ${lead.favorite ? "fill-amber-400 text-amber-400" : ""}`}
              />
            </Button>
            <span className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                title="Analiza evidencia / inferencia / especulación y guarda en Análisis IA"
                disabled={analyzing || loading}
                onClick={() => void detectPains()}
              >
                {analyzing ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <ScanSearch className="h-[18px] w-[18px]" />
                )}
                {analyzing ? "Detectando…" : "Detectar dolores"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Archivar"
                onClick={() => setConfirmArchive(true)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </span>
          </div>
        ) : null}

        {loading && !lead ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded bg-(--muted)"
              />
            ))}
          </div>
        ) : lead ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <Section title="Empresa">
              <Field label="Nombre" value={lead.companyName} />
              <Field label="Web" value={lead.website} />
              <Field label="Dirección" value={lead.address} />
              <Field
                label="Ciudad"
                value={lead.cityCanonical ?? lead.city}
              />
              <Field label="Provincia" value={lead.province} />
              <Field label="CP" value={lead.postalCode} />
              <Field label="Empleados" value={lead.employees?.toString()} />
              <Field label="Servicios" value={lead.services.join(", ")} />
              <Field label="Software" value={lead.software} />
            </Section>

            <Section title="Contacto">
              <Field label="Email" value={lead.email} />
              <Field label="Comercial" value={lead.emailCommercial} />
              <Field label="Gerente email" value={lead.emailManager} />
              <Field label="Teléfono" value={lead.phone} />
              <Field label="LinkedIn" value={lead.linkedin} />
              <Field label="Gerente" value={lead.manager} />
              <Field label="Cargo" value={lead.role} />
            </Section>

            <Section title="CRM">
              <label className="block text-[11px] text-(--muted-fg)">
                Estado
              </label>
              <select
                className={`mt-1 w-full rounded-md border border-(--border) bg-(--bg) px-2 py-1.5 text-sm ${statusColor(lead.status)}`}
                value={lead.status}
                disabled={saving}
                onChange={(e) =>
                  savePatch({ status: e.target.value as LeadStatus })
                }
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Field label="Score" value={lead.score?.toString()} />
              <Field label="Confianza" value={lead.confidence} />
              <Field label="Origen" value={lead.source} />
              <Field
                label="Creación"
                value={lead.createdAt?.slice(0, 10)}
              />
              <Field
                label="Última actividad"
                value={lead.lastActivity?.slice(0, 10)}
              />
              <Field
                label="Próximo seguimiento"
                value={lead.nextFollowUp?.slice(0, 10)}
              />
            </Section>

            <AiAnalysisPanel
              sectionRef={doloresRef}
              analyzing={analyzing}
              error={analyzeError}
              empty={analyzeEmpty}
              analysis={resolvePainAnalysis(apiAnalysis, lead.aiAnalysis)}
              onRetry={() => void detectPains(true)}
            />

            <Section title="Notas">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
              />
              {notes.length >= OBSERVACIONES_SOFT_LIMIT && (
                <p className="mt-1 text-[11px] text-amber-400">
                  Cerca del límite Notion (~2000). El excedente se guarda en el
                  cuerpo de la página.
                </p>
              )}
              <Button
                className="mt-2"
                size="sm"
                disabled={saving}
                onClick={() => savePatch({ notes })}
              >
                Guardar notas
              </Button>
            </Section>

            <Section title="Email preparado">
              <EmailEditor
                subject={emailSubject}
                body={emailBody}
                to={pickLeadEmail(lead)}
                onSubjectChange={setEmailSubject}
                onBodyChange={setEmailBody}
                saving={saving}
                onSave={() =>
                  void savePatch({
                    emailSubject,
                    emailBody,
                  })
                }
                onCopy={() =>
                  copy(`${emailSubject}\n\n${emailBody}`, "Email")
                }
                onMarkPrepared={() =>
                  void savePatch({
                    emailSubject,
                    emailBody,
                    status: "Email preparado",
                  })
                }
              />
            </Section>

            <Section title="Actividad">
              {activity.length === 0 ? (
                <p className="text-[12px] text-(--muted-fg)">
                  Sin eventos todavía.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activity.map((a, i) => (
                    <li
                      key={`${a.at}-${i}`}
                      className="border-l-2 border-(--border) pl-2 text-[12px]"
                    >
                      <div className="text-[10px] text-(--muted-fg)">
                        {a.at ? new Date(a.at).toLocaleString("es-ES") : ""} ·{" "}
                        {a.type}
                      </div>
                      <div>{a.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        ) : (
          <p className="p-4 text-(--muted-fg)">Lead no encontrado</p>
        )}
      </aside>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogTitle>Archivar lead</DialogTitle>
          <DialogDescription>
            Se archivará en Notion (no se elimina). Podrás usarlo para control
            de duplicados.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={archive}>
              Archivar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg)">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-[12.5px]">
      <span className="text-(--muted-fg)">{label}</span>
      <span className="break-words text-(--fg)">{value || "—"}</span>
    </div>
  );
}

function Action({
  href,
  icon: Icon,
  tip,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tip: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={tip}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gris-300 bg-transparent text-gris-500 transition-colors hover:bg-gris-100 hover:text-grafito dark:border-gris-600 dark:hover:bg-gris-800 dark:hover:text-gris-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rojo focus-visible:ring-offset-2"
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}
