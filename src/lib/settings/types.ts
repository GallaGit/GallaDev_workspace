export const INTEGRATION_IDS = ["ai", "serpapi"] as const;

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
  ai: {
    provider: SourcedString;
    apiKey: SourcedString;
    model: SourcedString;
  };
  serpapi: {
    apiKey: SourcedString;
  };
  connections: Record<IntegrationId, IntegrationConnectionState>;
}

export interface SettingsFile {
  ai?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  };
  serpapi?: {
    apiKey?: string;
  };
  connections?: Partial<Record<IntegrationId, IntegrationConnectionState>>;
}

export interface SettingsPatch {
  ai?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  };
  serpapi?: {
    apiKey?: string;
  };
}

export interface MaskedField {
  configured: boolean;
  preview: string | null;
  source: ValueSource;
}

export interface PublicSettings {
  authDisabled: boolean;
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
}

export interface FieldErrors {
  [path: string]: string;
}
