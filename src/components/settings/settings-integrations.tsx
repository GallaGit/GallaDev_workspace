"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectionBadge } from "@/components/settings/connection-badge";
import { SecretField, TextField } from "@/components/settings/fields";
import type {
  AutomationAction,
  IntegrationId,
  PublicSettings,
  SettingsPatch,
} from "@/lib/settings/types";
import { AUTOMATION_ACTION_IDS } from "@/lib/settings/types";
import { useSessionAccess } from "@/components/session-access";

type Draft = {
  n8nBaseUrl: string;
  n8nApiKey: string;
  n8nWebhooks: Record<AutomationAction, string>;
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  serpapiKey: string;
};

const CATALOG_KEYS: Record<AutomationAction, "leadCreated" | "leadUpdated" | "leadAnalyzed"> = {
  lead_created: "leadCreated",
  lead_updated: "leadUpdated",
  lead_analyzed: "leadAnalyzed",
};

function seedDraft(settings: PublicSettings): Draft {
  return {
    n8nBaseUrl: "",
    n8nApiKey: "",
    n8nWebhooks: {
      lead_created: "",
      lead_updated: "",
      lead_analyzed: "",
    },
    aiProvider: settings.ai.provider || "groq",
    aiApiKey: "",
    aiModel: settings.ai.model,
    serpapiKey: "",
  };
}

function optionalSecret(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function SettingsIntegrations() {
  const t = useTranslations("settings");
  const { isAdmin, ready } = useSessionAccess();
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<PublicSettings> => {
      const res = await fetch("/api/settings");
      const data = (await res.json()) as PublicSettings & { error?: string };
      if (!res.ok) throw new Error(data.error || t("loadError"));
      return data;
    },
    enabled: ready && isAdmin,
  });

  if (!ready || (isAdmin && query.isPending)) {
    return <p className="text-sm text-(--muted-fg)">{t("loading")}</p>;
  }
  if (!isAdmin) {
    return <p className="text-sm text-(--muted-fg)">{t("adminOnlyView")}</p>;
  }
  if (query.isError || !query.data) {
    return (
      <p className="text-sm text-red-400">
        {query.error instanceof Error ? query.error.message : t("loadError")}
      </p>
    );
  }

  return <SettingsForm settings={query.data} />;
}

function SettingsForm({ settings: initial }: { settings: PublicSettings }) {
  const t = useTranslations("settings");
  const tAuto = useTranslations("automations");
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(initial);
  const [draft, setDraft] = useState(() => seedDraft(initial));
  const [saving, setSaving] = useState<IntegrationId | null>(null);
  const [testing, setTesting] = useState<IntegrationId | null>(null);
  const [clearing, setClearing] = useState<Record<string, boolean>>({});
  const { isAdmin } = useSessionAccess();

  function remember(next: PublicSettings) {
    setSettings(next);
    setDraft(seedDraft(next));
    setClearing({});
    queryClient.setQueryData(["settings"], next);
  }

  async function save(patch: SettingsPatch, scope: IntegrationId) {
    if (!isAdmin) {
      toast.error(t("permissionDenied"));
      return;
    }
    setSaving(scope);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as PublicSettings & {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok) {
        const first = data.fieldErrors
          ? Object.values(data.fieldErrors)[0]
          : data.error;
        throw new Error(first || t("saveFailed"));
      }
      remember(data);
      toast.success(t("saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setSaving(null);
    }
  }

  async function test(integration: IntegrationId, overrides?: SettingsPatch) {
    if (!isAdmin) {
      toast.error(t("permissionDenied"));
      return;
    }
    setTesting(integration);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration, overrides }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        settings?: PublicSettings;
      };
      if (!res.ok) throw new Error(data.error || t("testError"));
      if (data.settings) {
        setSettings(data.settings);
        queryClient.setQueryData(["settings"], data.settings);
      }
      if (data.ok) toast.success(data.message || t("connectionOk"));
      else toast.error(data.message || t("connectionFailed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("testError"));
    } finally {
      setTesting(null);
    }
  }

  function markClear(key: string) {
    setClearing((c) => ({ ...c, [key]: true }));
  }

  return (
    <div className="space-y-4">
      {!isAdmin ? (
        <p className="text-sm text-(--muted-fg)">{t("adminOnlyChange")}</p>
      ) : null}

      <p className="text-sm text-(--muted-fg)">{t("secretsInfo")}</p>

      <div className="rounded-lg border border-(--border) bg-(--panel) px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span>{t("authDisabled")}</span>
          <span
            className={
              settings.authDisabled ? "text-emerald-400" : "text-amber-400"
            }
          >
            {settings.authDisabled ? t("connection.ok") : t("active")}
          </span>
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-(--border) bg-(--panel) p-4">
        <Header
          title="n8n"
          configured={settings.n8n.configured}
          connection={settings.n8n.connection}
          pending={testing === "n8n"}
        />
        <TextField
          id="n8n-url"
          label={t("urlBase")}
          value={draft.n8nBaseUrl}
          onChange={(v) => setDraft((d) => ({ ...d, n8nBaseUrl: v }))}
          placeholder="https://n8n.ejemplo.com"
          hint={
            settings.n8n.baseUrl.configured
              ? t("urlHintConfigured", {
                  preview: settings.n8n.baseUrl.preview ?? "",
                })
              : t("urlHintEmpty")
          }
          disabled={!isAdmin}
        />
        {isAdmin && settings.n8n.baseUrl.configured ? (
          <ClearLink
            onClick={() => markClear("n8n.baseUrl")}
            active={Boolean(clearing["n8n.baseUrl"])}
          />
        ) : null}
        <SecretField
          id="n8n-key"
          label={t("apiKey")}
          field={settings.n8n.apiKey}
          value={draft.n8nApiKey}
          onChange={(v) => setDraft((d) => ({ ...d, n8nApiKey: v }))}
          disabled={!isAdmin}
        />
        {isAdmin && settings.n8n.apiKey.source === "file" ? (
          <ClearLink
            onClick={() => markClear("n8n.apiKey")}
            active={Boolean(clearing["n8n.apiKey"])}
          />
        ) : null}
        {AUTOMATION_ACTION_IDS.map((action) => (
          <SecretField
            key={action}
            id={`n8n-wh-${action}`}
            label={t("webhook", {
              name: tAuto(`catalog.${CATALOG_KEYS[action]}.name`),
            })}
            field={settings.n8n.webhooks[action]}
            value={draft.n8nWebhooks[action]}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                n8nWebhooks: { ...d.n8nWebhooks, [action]: v },
              }))
            }
            placeholder="https://…/webhook/…"
            disabled={!isAdmin}
          />
        ))}
        <Actions
          saving={saving === "n8n"}
          testing={testing === "n8n"}
          onSave={() => {
            const webhooks: Partial<Record<AutomationAction, string>> = {};
            for (const action of AUTOMATION_ACTION_IDS) {
              const value = optionalSecret(draft.n8nWebhooks[action]);
              if (value) webhooks[action] = value;
            }
            void save(
              {
                n8n: {
                  baseUrl: clearing["n8n.baseUrl"]
                    ? ""
                    : draft.n8nBaseUrl.trim()
                      ? draft.n8nBaseUrl.trim()
                      : undefined,
                  apiKey: clearing["n8n.apiKey"]
                    ? ""
                    : optionalSecret(draft.n8nApiKey),
                  webhooks,
                },
              },
              "n8n",
            );
          }}
          locked={!isAdmin}
          onTest={() =>
            void test("n8n", {
              n8n: {
                baseUrl: draft.n8nBaseUrl.trim() || undefined,
                apiKey: optionalSecret(draft.n8nApiKey),
              },
            })
          }
        />
      </section>

      <section className="space-y-3 rounded-lg border border-(--border) bg-(--panel) p-4">
        <Header
          title="IA"
          configured={settings.ai.configured}
          connection={settings.ai.connection}
          pending={testing === "ai"}
        />
        <div>
          <label
            htmlFor="ai-provider"
            className="mb-1 block text-[11px] font-medium text-(--muted-fg)"
          >
            {t("provider")}
          </label>
          <select
            id="ai-provider"
            className="flex h-8 w-full rounded-md border border-(--border) bg-(--bg) px-2.5 text-sm text-(--fg) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--ring)"
            value={draft.aiProvider}
            disabled={!isAdmin}
            onChange={(e) =>
              setDraft((d) => ({ ...d, aiProvider: e.target.value }))
            }
          >
            <option value="groq">Groq</option>
          </select>
        </div>
        <SecretField
          id="ai-key"
          label={t("apiKey")}
          field={settings.ai.apiKey}
          value={draft.aiApiKey}
          onChange={(v) => setDraft((d) => ({ ...d, aiApiKey: v }))}
          disabled={!isAdmin}
        />
        {isAdmin && settings.ai.apiKey.source === "file" ? (
          <ClearLink
            onClick={() => markClear("ai.apiKey")}
            active={Boolean(clearing["ai.apiKey"])}
          />
        ) : null}
        <TextField
          id="ai-model"
          label={t("model")}
          value={draft.aiModel}
          onChange={(v) => setDraft((d) => ({ ...d, aiModel: v }))}
          disabled={!isAdmin}
        />
        <Actions
          saving={saving === "ai"}
          testing={testing === "ai"}
          onSave={() =>
            void save(
              {
                ai: {
                  provider:
                    draft.aiProvider !== settings.ai.provider
                      ? draft.aiProvider
                      : undefined,
                  apiKey: clearing["ai.apiKey"]
                    ? ""
                    : optionalSecret(draft.aiApiKey),
                  model:
                    draft.aiModel !== settings.ai.model
                      ? draft.aiModel
                      : undefined,
                },
              },
              "ai",
            )
          }
          locked={!isAdmin}
          onTest={() =>
            void test("ai", {
              ai: {
                provider: draft.aiProvider,
                apiKey: optionalSecret(draft.aiApiKey),
                model: draft.aiModel,
              },
            })
          }
        />
      </section>

      <section className="space-y-3 rounded-lg border border-(--border) bg-(--panel) p-4">
        <Header
          title="SerpAPI"
          configured={settings.serpapi.configured}
          connection={settings.serpapi.connection}
          pending={testing === "serpapi"}
        />
        <SecretField
          id="serp-key"
          label={t("apiKey")}
          field={settings.serpapi.apiKey}
          value={draft.serpapiKey}
          onChange={(v) => setDraft((d) => ({ ...d, serpapiKey: v }))}
          disabled={!isAdmin}
        />
        {isAdmin && settings.serpapi.apiKey.source === "file" ? (
          <ClearLink
            onClick={() => markClear("serpapi.apiKey")}
            active={Boolean(clearing["serpapi.apiKey"])}
          />
        ) : null}
        <Actions
          saving={saving === "serpapi"}
          testing={testing === "serpapi"}
          onSave={() =>
            void save(
              {
                serpapi: {
                  apiKey: clearing["serpapi.apiKey"]
                    ? ""
                    : optionalSecret(draft.serpapiKey),
                },
              },
              "serpapi",
            )
          }
          locked={!isAdmin}
          onTest={() =>
            void test("serpapi", {
              serpapi: { apiKey: optionalSecret(draft.serpapiKey) },
            })
          }
        />
      </section>
    </div>
  );
}

function Header({
  title,
  configured,
  connection,
  pending,
}: {
  title: string;
  configured: boolean;
  connection: PublicSettings["n8n"]["connection"];
  pending?: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
        <p className="text-[11px] text-(--muted-fg)">
          {configured ? t("credentialsPresent") : t("pendingConfiguration")}
        </p>
      </div>
      <ConnectionBadge connection={connection} pending={pending} />
    </div>
  );
}

function Actions({
  saving,
  testing,
  locked = false,
  onSave,
  onTest,
}: {
  saving: boolean;
  testing: boolean;
  locked?: boolean;
  onSave: () => void;
  onTest: () => void;
}) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button size="sm" onClick={onSave} disabled={locked || saving || testing}>
        {saving ? t("saving") : t("save")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onTest}
        disabled={locked || saving || testing}
      >
        {testing ? t("testing") : t("testConnection")}
      </Button>
    </div>
  );
}

function ClearLink({
  onClick,
  active,
}: {
  onClick: () => void;
  active: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] text-(--muted-fg) underline-offset-2 hover:text-(--fg) hover:underline"
    >
      {active ? t("willResetEnv") : t("resetEnv")}
    </button>
  );
}
