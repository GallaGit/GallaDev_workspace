export const AUTOMATION_ACTION_IDS = [
  "lead_created",
  "lead_updated",
  "lead_analyzed",
] as const;

export type AutomationAction = (typeof AUTOMATION_ACTION_IDS)[number];

export const INTEGRATION_IDS = ["n8n", "ai", "serpapi"] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export const CONNECTION_STATUSES = ["never", "syncing", "ok", "error"] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type ValueSource = "env" | "file" | "default" | "none";

export type AiProvider = "groq";

export interface IntegrationConnectionState {
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SourcedString {
  value: string;
  source: ValueSource;
}

export interface SourcedBoolean {
  value: boolean;
  source: ValueSource;
}

export interface ResolvedSettings {
  n8n: {
    baseUrl: SourcedString;
    apiKey: SourcedString;
    webhooks: Record<AutomationAction, SourcedString>;
  };
  ai: {
    provider: SourcedString;
    apiKey: SourcedString;
    model: SourcedString;
  };
  serpapi: {
    apiKey: SourcedString;
  };
  automations: Record<AutomationAction, { enabled: SourcedBoolean }>;
  connections: Record<IntegrationId, IntegrationConnectionState>;
}

export interface SettingsFile {
  n8n?: {
    baseUrl?: string;
    apiKey?: string;
    webhooks?: Partial<Record<AutomationAction, string>>;
  };
  ai?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  };
  serpapi?: {
    apiKey?: string;
  };
  automations?: Partial<
    Record<AutomationAction, { enabled?: boolean; webhookUrl?: string }>
  >;
  connections?: Partial<Record<IntegrationId, IntegrationConnectionState>>;
}

export interface SettingsPatch {
  n8n?: {
    baseUrl?: string;
    apiKey?: string;
    webhooks?: Partial<Record<AutomationAction, string>>;
  };
  ai?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  };
  serpapi?: {
    apiKey?: string;
  };
  automations?: Partial<
    Record<AutomationAction, { enabled?: boolean; webhookUrl?: string }>
  >;
}

export interface MaskedField {
  configured: boolean;
  preview: string | null;
  source: ValueSource;
}

export interface PublicAutomation {
  action: AutomationAction;
  name: string;
  description: string;
  enabled: boolean;
  webhook: MaskedField;
}

export interface PublicSettings {
  authDisabled: boolean;
  n8n: {
    configured: boolean;
    baseUrl: string;
    apiKey: MaskedField;
    webhooks: Record<AutomationAction, MaskedField>;
    connection: IntegrationConnectionState;
  };
  ai: {
    configured: boolean;
    provider: string;
    apiKey: MaskedField;
    model: string;
    connection: IntegrationConnectionState;
  };
  serpapi: {
    configured: boolean;
    apiKey: MaskedField;
    connection: IntegrationConnectionState;
  };
  automations: PublicAutomation[];
}

export interface FieldErrors {
  [path: string]: string;
}
