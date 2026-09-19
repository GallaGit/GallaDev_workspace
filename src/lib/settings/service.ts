import "server-only";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  AUTOMATION_CATALOG,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
} from "./catalog";
import {
  AUTOMATION_ACTION_IDS,
  INTEGRATION_IDS,
  type AutomationAction,
  type IntegrationConnectionState,
  type IntegrationId,
  type ResolvedSettings,
  type SettingsFile,
  type SettingsPatch,
  type SourcedBoolean,
  type SourcedString,
} from "./types";

const EMPTY_CONNECTION: IntegrationConnectionState = {
  status: "never",
  lastSyncedAt: null,
  lastError: null,
};

function defaultFilePath(): string {
  return path.join(process.cwd(), "data", "settings.local.json");
}

function envValue(...keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function sourced(
  fileValue: string | undefined,
  env: string,
  fallback = "",
): SourcedString {
  if (fileValue?.trim()) return { value: fileValue.trim(), source: "file" };
  if (env) return { value: env, source: "env" };
  if (fallback) return { value: fallback, source: "default" };
  return { value: "", source: "none" };
}

function sourcedEnabled(
  fileValue: boolean | undefined,
  webhookConfigured: boolean,
): SourcedBoolean {
  if (typeof fileValue === "boolean") {
    return { value: fileValue, source: "file" };
  }
  return { value: webhookConfigured, source: "default" };
}

function applyOverride(
  current: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (incoming === undefined) return current;
  const trimmed = incoming.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConnection(
  value: unknown,
): IntegrationConnectionState | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  if (
    status !== "never" &&
    status !== "syncing" &&
    status !== "ok" &&
    status !== "error"
  ) {
    return undefined;
  }
  return {
    status,
    lastSyncedAt:
      typeof value.lastSyncedAt === "string" ? value.lastSyncedAt : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
  };
}

function parseFile(raw: unknown): SettingsFile {
  if (!isRecord(raw)) return {};
  const file: SettingsFile = {};


  if (isRecord(raw.n8n)) {
    const webhooks: Partial<Record<AutomationAction, string>> = {};
    if (isRecord(raw.n8n.webhooks)) {
      for (const action of AUTOMATION_ACTION_IDS) {
        const url = raw.n8n.webhooks[action];
        if (typeof url === "string") webhooks[action] = url;
      }
    }
    file.n8n = {
      baseUrl: typeof raw.n8n.baseUrl === "string" ? raw.n8n.baseUrl : undefined,
      apiKey: typeof raw.n8n.apiKey === "string" ? raw.n8n.apiKey : undefined,
      webhooks,
    };
  }

  if (isRecord(raw.ai)) {
    file.ai = {
      provider: typeof raw.ai.provider === "string" ? raw.ai.provider : undefined,
      apiKey: typeof raw.ai.apiKey === "string" ? raw.ai.apiKey : undefined,
      model: typeof raw.ai.model === "string" ? raw.ai.model : undefined,
    };
  }

  if (isRecord(raw.serpapi)) {
    file.serpapi = {
      apiKey:
        typeof raw.serpapi.apiKey === "string" ? raw.serpapi.apiKey : undefined,
    };
  }

  if (isRecord(raw.automations)) {
    const automations: SettingsFile["automations"] = {};
    for (const action of AUTOMATION_ACTION_IDS) {
      const item = raw.automations[action];
      if (!isRecord(item)) continue;
      automations[action] = {
        enabled: typeof item.enabled === "boolean" ? item.enabled : undefined,
        webhookUrl:
          typeof item.webhookUrl === "string" ? item.webhookUrl : undefined,
      };
    }
    file.automations = automations;
  }

  if (isRecord(raw.connections)) {
    const connections: SettingsFile["connections"] = {};
    for (const id of INTEGRATION_IDS) {
      const parsed = parseConnection(raw.connections[id]);
      if (parsed) connections[id] = parsed;
    }
    file.connections = connections;
  }

  return file;
}

function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (isRecord(value) && Object.keys(value).length === 0) continue;
    next[key] = value;
  }
  return next as Partial<T>;
}

export class SettingsService {
  constructor(private readonly filePath = defaultFilePath()) {}

  getRaw(): ResolvedSettings {
    return this.merge(this.readFile());
  }

  patch(patch: SettingsPatch): ResolvedSettings {
    const next = this.applyPatch(this.readFile(), patch);
    this.writeFile(next);
    return this.merge(next);
  }

  setConnection(
    id: IntegrationId,
    state: IntegrationConnectionState,
  ): ResolvedSettings {
    const file = this.readFile();
    const next: SettingsFile = {
      ...file,
      connections: { ...file.connections, [id]: state },
    };
    this.writeFile(next);
    return this.merge(next);
  }

  private merge(file: SettingsFile): ResolvedSettings {
    const webhooks = {} as Record<AutomationAction, SourcedString>;
    const automations = {} as ResolvedSettings["automations"];

    for (const action of AUTOMATION_ACTION_IDS) {
      const catalog = AUTOMATION_CATALOG[action];
      const fileUrl =
        file.n8n?.webhooks?.[action] ?? file.automations?.[action]?.webhookUrl;
      webhooks[action] = sourced(fileUrl, envValue(...catalog.envKeys));
      automations[action] = {
        enabled: sourcedEnabled(
          file.automations?.[action]?.enabled,
          Boolean(webhooks[action].value),
        ),
      };
    }

    const connections = {} as ResolvedSettings["connections"];
    for (const id of INTEGRATION_IDS) {
      connections[id] = file.connections?.[id] ?? { ...EMPTY_CONNECTION };
    }

    return {
      n8n: {
        baseUrl: sourced(file.n8n?.baseUrl, envValue("N8N_BASE_URL", "N8N_URL")),
        apiKey: sourced(file.n8n?.apiKey, envValue("N8N_API_KEY")),
        webhooks,
      },
      ai: {
        provider: sourced(
          file.ai?.provider,
          envValue("AI_PROVIDER"),
          DEFAULT_AI_PROVIDER,
        ),
        apiKey: sourced(
          file.ai?.apiKey,
          envValue("GROQ_API_KEY", "AI_API_KEY"),
        ),
        model: sourced(
          file.ai?.model,
          envValue("GROQ_MODEL", "AI_MODEL"),
          DEFAULT_AI_MODEL,
        ),
      },
      serpapi: {
        apiKey: sourced(
          file.serpapi?.apiKey,
          envValue("SERPAPI_API_KEY", "SERP_API_KEY"),
        ),
      },
      automations,
      connections,
    };
  }

  private applyPatch(file: SettingsFile, patch: SettingsPatch): SettingsFile {
    const n8nWebhooks = { ...file.n8n?.webhooks };
    if (patch.n8n?.webhooks) {
      for (const action of AUTOMATION_ACTION_IDS) {
        if (patch.n8n.webhooks[action] === undefined) continue;
        n8nWebhooks[action] = applyOverride(
          n8nWebhooks[action],
          patch.n8n.webhooks[action],
        );
      }
    }

    const automations = { ...file.automations };
    if (patch.automations) {
      for (const action of AUTOMATION_ACTION_IDS) {
        const incoming = patch.automations[action];
        if (!incoming) continue;
        const current = { ...automations[action] };
        if (incoming.enabled !== undefined) current.enabled = incoming.enabled;
        if (incoming.webhookUrl !== undefined) {
          current.webhookUrl = applyOverride(
            current.webhookUrl,
            incoming.webhookUrl,
          );
          n8nWebhooks[action] = applyOverride(
            n8nWebhooks[action],
            incoming.webhookUrl,
          );
        }
        automations[action] = current;
      }
    }

    const n8n = {
      ...file.n8n,
      webhooks: n8nWebhooks,
      ...(patch.n8n
        ? {
            baseUrl: applyOverride(file.n8n?.baseUrl, patch.n8n.baseUrl),
            apiKey: applyOverride(file.n8n?.apiKey, patch.n8n.apiKey),
          }
        : {}),
    };

    const ai = { ...file.ai };
    if (patch.ai) {
      ai.provider = applyOverride(ai.provider, patch.ai.provider);
      ai.apiKey = applyOverride(ai.apiKey, patch.ai.apiKey);
      ai.model = applyOverride(ai.model, patch.ai.model);
    }

    const serpapi = { ...file.serpapi };
    if (patch.serpapi) {
      serpapi.apiKey = applyOverride(serpapi.apiKey, patch.serpapi.apiKey);
    }

    return pruneEmpty({
      n8n: pruneEmpty({ ...n8n, webhooks: pruneEmpty(n8nWebhooks) }),
      ai: pruneEmpty(ai),
      serpapi: pruneEmpty(serpapi),
      automations: pruneEmpty(
        Object.fromEntries(
          AUTOMATION_ACTION_IDS.map((action) => [
            action,
            automations[action]
              ? pruneEmpty(automations[action] as Record<string, unknown>)
              : undefined,
          ]),
        ),
      ),
      connections: file.connections,
    }) as SettingsFile;
  }

  private readFile(): SettingsFile {
    try {
      if (!existsSync(this.filePath)) return {};
      const contents = readFileSync(this.filePath, "utf8");
      return parseFile(JSON.parse(contents) as unknown);
    } catch (error) {
      console.warn("[settings] no se pudo leer settings.local.json", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      return {};
    }
  }

  private writeFile(file: SettingsFile): void {
    const dir = path.dirname(this.filePath);
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmp = `${this.filePath}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      renameSync(tmp, this.filePath);
    } catch (error) {
      const tmp = `${this.filePath}.tmp`;
      if (existsSync(tmp)) {
        try {
          unlinkSync(tmp);
        } catch {
          /* ignore */
        }
      }
      const message =
        error instanceof Error ? error.message : "Error de escritura";
      throw new Error(
        `No se pudo guardar data/settings.local.json (${message})`,
      );
    }
  }
}

let instance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  instance ??= new SettingsService();
  return instance;
}
