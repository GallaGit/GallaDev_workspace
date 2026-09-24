"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SecretField } from "@/components/settings/fields";
import type { PublicAutomation, PublicSettings } from "@/lib/settings/types";
import { useSessionAccess } from "@/components/session-access";

async function fetchAutomations(): Promise<PublicAutomation[]> {
  const res = await fetch("/api/automations");
  const data = (await res.json()) as {
    automations?: PublicAutomation[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "No se pudieron cargar");
  return data.automations ?? [];
}

export function AutomationsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["automations"],
    queryFn: fetchAutomations,
  });
  const [webhookDraft, setWebhookDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { isAdmin } = useSessionAccess();

  async function patch(
    action: string,
    body: { enabled?: boolean; webhookUrl?: string },
  ) {
    if (!isAdmin) {
      toast.error("No tienes permiso para realizar esta acción");
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/automations/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        settings?: PublicSettings;
        automation?: PublicAutomation;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      if (data.settings) {
        queryClient.setQueryData(["automations"], data.settings.automations);
        queryClient.setQueryData(["settings"], data.settings);
      } else if (data.automation) {
        queryClient.setQueryData(["automations"], (cur: PublicAutomation[] | undefined) =>
          (cur ?? []).map((a) => (a.action === action ? data.automation! : a)),
        );
      }
      setWebhookDraft((d) => ({ ...d, [action]: "" }));
      toast.success("Automatización actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(null);
    }
  }

  async function test(action: string) {
    if (!isAdmin) {
      toast.error("No tienes permiso para realizar esta acción");
      return;
    }
    setBusy(`test:${action}`);
    try {
      const res = await fetch(`/api/automations/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          data.error ||
            (typeof data.status === "number"
              ? `Webhook HTTP ${data.status}`
              : "La prueba falló"),
        );
      }
      toast.success(`Webhook respondió HTTP ${data.status ?? 200}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al probar");
    } finally {
      setBusy(null);
    }
  }

  if (query.isPending) {
    return <p className="text-sm text-muted-fg">Cargando…</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-red-400">
        {query.error instanceof Error
          ? query.error.message
          : "No se pudieron cargar las automatizaciones"}
      </p>
    );
  }

  const items = query.data ?? [];

  return (
    <div className="space-y-3">
      {!isAdmin ? (
        <p className="text-sm text-muted-fg">
          Solo un administrador puede cambiar o probar automatizaciones.
        </p>
      ) : null}
      <p className="text-sm text-muted-fg">
        La captación se lanza en n8n (Manual o semanal), no desde esta pantalla.
        Leads_CRM no edita el workflow. En v1 no actives los toggles ni pegues
        URLs: la capa de webhooks está lista, pero el workflow no tiene esos
        triggers.
      </p>
      {items.map((item) => {
        const configured = item.webhook.configured;
        const inactive = !item.enabled;
        return (
          <section
            key={item.action}
            className="space-y-3 rounded-lg border border-border bg-panel p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[13px] font-medium tracking-tight">
                  {item.name}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-fg">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-fg">
                  {item.enabled ? "Activa" : "Inactiva"}
                </span>
                <Switch
                  checked={item.enabled}
                  disabled={!isAdmin || busy === item.action}
                  onCheckedChange={(enabled) =>
                    void patch(item.action, { enabled })
                  }
                  label={`${item.name} activa`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={
                  configured ? "text-emerald-400" : "text-muted-fg"
                }
              >
                {configured ? "Webhook configurado" : "Sin webhook"}
              </span>
              <span className="text-muted-fg">
                {inactive ? "No se disparará hasta activarla" : "Lista"}
              </span>
            </div>

            <SecretField
              id={`auto-wh-${item.action}`}
              label="URL del webhook"
              field={item.webhook}
              value={webhookDraft[item.action] ?? ""}
              onChange={(v) =>
                setWebhookDraft((d) => ({ ...d, [item.action]: v }))
              }
              placeholder="https://…/webhook/…"
              hint="Vacío = no cambiar. Guarda para persistir un override local."
              disabled={!isAdmin}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!isAdmin || busy !== null}
                onClick={() =>
                  void patch(item.action, {
                    webhookUrl: webhookDraft[item.action]?.trim() || undefined,
                  })
                }
              >
                Guardar URL
              </Button>
              <Button
                size="sm"
                disabled={!isAdmin || busy !== null || !configured}
                onClick={() => void test(item.action)}
              >
                {busy === `test:${item.action}` ? "Enviando…" : "Probar"}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
