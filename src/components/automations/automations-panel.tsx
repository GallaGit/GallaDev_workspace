"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SecretField } from "@/components/settings/fields";
import type { AutomationAction, PublicAutomation, PublicSettings } from "@/lib/settings/types";
import { useSessionAccess } from "@/components/session-access";

const CATALOG_KEYS: Record<
  AutomationAction,
  "leadCreated" | "leadUpdated" | "leadAnalyzed"
> = {
  lead_created: "leadCreated",
  lead_updated: "leadUpdated",
  lead_analyzed: "leadAnalyzed",
};

export function AutomationsPanel() {
  const t = useTranslations("automations");
  const queryClient = useQueryClient();
  const { isAdmin, ready } = useSessionAccess();
  const query = useQuery({
    queryKey: ["automations"],
    queryFn: async (): Promise<PublicAutomation[]> => {
      const res = await fetch("/api/automations");
      const data = (await res.json()) as {
        automations?: PublicAutomation[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || t("loadError"));
      return data.automations ?? [];
    },
    enabled: ready && isAdmin,
  });
  const [webhookDraft, setWebhookDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(
    action: string,
    body: { enabled?: boolean; webhookUrl?: string },
  ) {
    if (!isAdmin) {
      toast.error(t("permissionDenied"));
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
      if (!res.ok) throw new Error(data.error || t("saveFailed"));
      if (data.settings) {
        queryClient.setQueryData(["automations"], data.settings.automations);
        queryClient.setQueryData(["settings"], data.settings);
      } else if (data.automation) {
        queryClient.setQueryData(["automations"], (cur: PublicAutomation[] | undefined) =>
          (cur ?? []).map((a) => (a.action === action ? data.automation! : a)),
        );
      }
      setWebhookDraft((d) => ({ ...d, [action]: "" }));
      toast.success(t("updated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setBusy(null);
    }
  }

  async function test(action: string) {
    if (!isAdmin) {
      toast.error(t("permissionDenied"));
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
              ? t("httpError", { status: data.status })
              : t("testFailed")),
        );
      }
      toast.success(t("httpSuccess", { status: data.status ?? 200 }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("testError"));
    } finally {
      setBusy(null);
    }
  }

  if (!ready || (isAdmin && query.isPending)) {
    return <p className="text-sm text-muted-fg">{t("loading")}</p>;
  }
  if (!isAdmin) {
    return <p className="text-sm text-muted-fg">{t("adminOnlyView")}</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-red-400">
        {query.error instanceof Error ? query.error.message : t("loadError")}
      </p>
    );
  }

  const items = query.data ?? [];

  return (
    <div className="space-y-3">
      {!isAdmin ? (
        <p className="text-sm text-muted-fg">{t("adminOnlyChange")}</p>
      ) : null}
      <p className="text-sm text-muted-fg">{t("description")}</p>
      {items.map((item) => {
        const configured = item.webhook.configured;
        const inactive = !item.enabled;
        const catalogKey = CATALOG_KEYS[item.action as AutomationAction];
        const name = catalogKey
          ? t(`catalog.${catalogKey}.name`)
          : item.name;
        const description = catalogKey
          ? t(`catalog.${catalogKey}.description`)
          : item.description;
        return (
          <section
            key={item.action}
            className="space-y-3 rounded-lg border border-border bg-panel p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[13px] font-medium tracking-tight">
                  {name}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-fg">
                  {description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-fg">
                  {item.enabled ? t("active") : t("inactive")}
                </span>
                <Switch
                  checked={item.enabled}
                  disabled={!isAdmin || busy === item.action}
                  onCheckedChange={(enabled) =>
                    void patch(item.action, { enabled })
                  }
                  label={`${name} ${t("active").toLowerCase()}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={
                  configured ? "text-emerald-400" : "text-muted-fg"
                }
              >
                {configured ? t("configured") : t("notConfigured")}
              </span>
              <span className="text-muted-fg">
                {inactive ? t("inactiveHint") : t("ready")}
              </span>
            </div>

            <SecretField
              id={`auto-wh-${item.action}`}
              label={t("webhookUrl")}
              field={item.webhook}
              value={webhookDraft[item.action] ?? ""}
              onChange={(v) =>
                setWebhookDraft((d) => ({ ...d, [item.action]: v }))
              }
              placeholder={t("webhookPlaceholder")}
              hint={t("webhookHint")}
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
                {t("saveUrl")}
              </Button>
              <Button
                size="sm"
                disabled={!isAdmin || busy !== null || !configured}
                onClick={() => void test(item.action)}
              >
                {busy === `test:${item.action}` ? t("sending") : t("test")}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
