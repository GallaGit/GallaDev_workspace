"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { EmailEditor } from "@/components/leads/email-editor";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import type { Lead } from "@/lib/domain/lead";
import { outreachV1 } from "@/lib/templates/outreach-v1";
import { pickLeadEmail } from "@/lib/utils/gmail-compose";
import { useUiStore } from "@/store/ui-store";
import { toastAutomationDispatch } from "@/components/automations/toast-dispatch";
import { useSessionAccess } from "@/components/session-access";

function hasDraft(lead: Lead): boolean {
  return (
    lead.status === "Email preparado" || Boolean(lead.emailBody?.trim())
  );
}

export function EmailWorkbenchPage() {
  useEnsureLeadsSynced();
  const leads = useUiStore((s) => s.leads);
  const upsertLead = useUiStore((s) => s.upsertLead);

  const candidates = useMemo(
    () =>
      leads
        .filter(hasDraft)
        .sort((a, b) =>
          (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""),
        ),
    [leads],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    candidates.find((l) => l.id === selectedId) ?? candidates[0] ?? null;

  return (
    <>
      <Topbar title="Email" />
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-(--border) bg-(--panel)">
          <div className="border-b border-(--border) px-3 py-2 text-[11px] text-(--muted-fg)">
            Borradores · {candidates.length}
          </div>
          {candidates.length === 0 ? (
            <p className="p-3 text-[12px] text-(--muted-fg)">
              No hay emails generados. Genera borradores en n8n o aplica la
              plantilla desde un lead.
            </p>
          ) : (
            <ul>
              {candidates.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full border-b border-(--border) px-3 py-2 text-left text-[12px] hover:bg-(--muted) ${
                      selected?.id === lead.id ? "bg-(--muted)" : ""
                    }`}
                  >
                    <div className="line-clamp-2 font-medium">
                      {lead.companyName}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-(--muted-fg)">
                      {lead.emailSubject || lead.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {!selected ? (
            <p className="text-sm text-(--muted-fg)">
              Selecciona un lead con borrador a la izquierda.
            </p>
          ) : (
            <EmailDraftPanel
              key={selected.id}
              selected={selected}
              upsertLead={upsertLead}
            />
          )}
        </div>
      </div>
    </>
  );
}

function EmailDraftPanel({
  selected,
  upsertLead,
}: {
  selected: Lead;
  upsertLead: (lead: Lead) => void;
}) {
  const [subject, setSubject] = useState(selected.emailSubject ?? "");
  const [body, setBody] = useState(selected.emailBody ?? "");
  const [saving, setSaving] = useState(false);
  const { canWriteLeads } = useSessionAccess();

  async function savePatch(patch: Partial<Lead>) {
    if (!canWriteLeads) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      upsertLead(data.lead);
      toast.success("Guardado");
      toastAutomationDispatch(data.automation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate() {
    if (body.trim()) {
      const ok = window.confirm(
        "El cuerpo no está vacío. ¿Sustituir por la plantilla outreach-v1?",
      );
      if (!ok) return;
    }
    const ctx = {
      empresa: selected.companyName,
      gerente: selected.manager,
      ciudad: selected.cityCanonical ?? selected.city,
    };
    setSubject(outreachV1.buildSubject(ctx));
    setBody(outreachV1.buildBody(ctx));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-sm font-semibold">{selected.companyName}</h2>
      <p className="mb-4 text-[12px] text-(--muted-fg)">
        {selected.email ?? "Sin correo"} · {selected.status}
      </p>
      <EmailEditor
        subject={subject}
        body={body}
        to={pickLeadEmail(selected)}
        onSubjectChange={setSubject}
        onBodyChange={setBody}
        saving={saving}
        readOnly={!canWriteLeads}
        showApplyTemplate
        onApplyTemplate={applyTemplate}
        onSave={() =>
          void savePatch({
            emailSubject: subject,
            emailBody: body,
          })
        }
        onCopy={() => {
          void navigator.clipboard.writeText(`${subject}\n\n${body}`);
          toast.success("Email copiado");
        }}
        onMarkPrepared={() =>
          void savePatch({
            emailSubject: subject,
            emailBody: body,
            status: "Email preparado",
          })
        }
      />
    </div>
  );
}
