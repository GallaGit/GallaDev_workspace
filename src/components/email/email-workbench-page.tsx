"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { toastAutomationDispatch } from "@/components/automations/toast-dispatch";
import { useSessionAccess } from "@/components/session-access";
import { Topbar } from "@/components/layout/topbar";
import { EmailEditor } from "@/components/leads/email-editor";
import { useEnsureLeadsSynced } from "@/hooks/use-ensure-leads-synced";
import type { AutomationDispatchResult } from "@/lib/automations/dispatch-result";
import type { Lead } from "@/lib/domain/lead";
import { readJsonResponse } from "@/lib/http/read-json";
import { leadStatusLabel } from "@/lib/i18n/lead-status-label";
import { outreachV1 } from "@/lib/templates/outreach-v1";
import { pickLeadEmail } from "@/lib/utils/gmail-compose";
import { useUiStore } from "@/store/ui-store";

function hasDraft(lead: Lead): boolean {
  return (
    lead.status === "Email preparado" || Boolean(lead.emailBody?.trim())
  );
}

export function EmailWorkbenchPage() {
  const t = useTranslations("email");
  const tStatus = useTranslations("leadStatus");
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
      <Topbar title={t("title")} />
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-(--border) bg-(--panel)">
          <div className="border-b border-(--border) px-3 py-2 text-[11px] text-(--muted-fg)">
            {t("draftCount", { count: candidates.length })}
          </div>
          {candidates.length === 0 ? (
            <p className="p-3 text-[12px] text-(--muted-fg)">{t("empty")}</p>
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
                      {lead.emailSubject || leadStatusLabel(tStatus, lead.status)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {!selected ? (
            <p className="text-sm text-(--muted-fg)">{t("select")}</p>
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
  const t = useTranslations("email");
  const tStatus = useTranslations("leadStatus");
  const tAuto = useTranslations("automations");
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
      const data = await readJsonResponse<{
        lead: Lead;
        automation?: AutomationDispatchResult;
      }>(res, t("saveError"));
      upsertLead(data.lead);
      toast.success(t("saved"));
      toastAutomationDispatch(data.automation, {
        dispatched: tAuto("dispatched"),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate() {
    if (body.trim()) {
      const ok = window.confirm(t("replaceTemplate"));
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
        {selected.email ?? t("noEmail")} ·{" "}
        {leadStatusLabel(tStatus, selected.status)}
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
          toast.success(t("copied"));
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
