/**
 * n8n HTTP client — no business logic.
 * Config comes from SettingsService. UI must not call this module.
 */

import "server-only";

import { resolveAutomationAction } from "@/lib/settings/catalog";
import { getSettingsService } from "@/lib/settings/service";
import type {
  AutomationAction,
  ResolvedSettings,
} from "@/lib/settings/types";
import { outboundUrlError } from "@/lib/settings/outbound-url";
import { N8nClientError } from "./errors";
import {
  leadAnalyzedPayload,
  leadCreatedPayload,
  leadUpdatedPayload,
} from "./payloads";

export type { N8nAction } from "./legacy";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type N8nLogger = Pick<Console, "info" | "warn" | "error">;

export interface WebhookTriggerResult {
  ok: boolean;
  status: number;
  body: unknown;
  parseError?: boolean;
  skipped?: boolean;
  durationMs: number;
}

export interface AutomationClient {
  triggerWebhook(
    urlOrAction: string,
    payload?: Record<string, unknown>,
  ): Promise<WebhookTriggerResult>;
  notifyLeadCreated(
    lead: Record<string, unknown>,
  ): Promise<WebhookTriggerResult>;
  notifyLeadUpdated(
    lead: Record<string, unknown>,
    changed?: string[],
  ): Promise<WebhookTriggerResult>;
  notifyLeadAnalyzed(
    lead: Record<string, unknown>,
    analysis?: Record<string, unknown>,
  ): Promise<WebhookTriggerResult>;
}

export interface N8nClientDeps {
  getSettings?: () => ResolvedSettings | Promise<ResolvedSettings>;
  fetch?: FetchLike;
  timeoutMs?: number;
  logger?: N8nLogger;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function timeoutMsFromEnv(fallback: number): number {
  const raw = Number(process.env.N8N_WEBHOOK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function parseBody(
  text: string,
  logger: N8nLogger,
): { body: unknown; parseError?: boolean } {
  if (!text) return { body: null };
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    logger.warn("[n8n] respuesta no JSON", { bytes: text.length });
    return { body: text.slice(0, 500), parseError: true };
  }
}

export class N8nClient implements AutomationClient {
  private readonly getSettings: () => Promise<ResolvedSettings>;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;
  private readonly logger: N8nLogger;

  constructor(deps: N8nClientDeps = {}) {
    this.getSettings = async () => deps.getSettings?.() ?? getSettingsService().getRaw();
    this.fetchFn = deps.fetch ?? fetch;
    this.timeoutMs = deps.timeoutMs ?? timeoutMsFromEnv(DEFAULT_TIMEOUT_MS);
    this.logger = deps.logger ?? console;
  }

  async getWebhookUrl(action: string): Promise<string | null> {
    const resolved = resolveAutomationAction(action);
    if (!resolved) return null;
    const settings = await this.getSettings();
    return settings.n8n.webhooks[resolved].value || null;
  }

  async listConfigured(): Promise<
    { action: AutomationAction; configured: boolean; enabled: boolean }[]
  > {
    const settings = await this.getSettings();
    return (Object.keys(settings.n8n.webhooks) as AutomationAction[]).map(
      (action) => ({
        action,
        configured: Boolean(settings.n8n.webhooks[action].value),
        enabled: settings.automations[action].enabled.value,
      }),
    );
  }

  async triggerWebhook(
    urlOrAction: string,
    payload: Record<string, unknown> = {},
  ): Promise<WebhookTriggerResult> {
    const started = Date.now();
    const url = await this.resolveUrl(urlOrAction);
    if (!url) {
      throw new N8nClientError(
        `Webhook n8n no configurado para ${urlOrAction}`,
        "not_configured",
      );
    }

    const label = looksLikeUrl(urlOrAction)
      ? "url"
      : (resolveAutomationAction(urlOrAction) ?? urlOrAction);
    this.assertOutboundUrl(url);

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const text = await response.text();
      const { body, parseError } = parseBody(text, this.logger);
      const durationMs = Date.now() - started;

      if (parseError && response.headers.get("content-type")?.includes("json")) {
        this.logger.warn("[n8n] JSON inválido", { action: label, status: response.status });
      }

      if (!response.ok) {
        this.logger.warn("[n8n] HTTP error", {
          action: label,
          status: response.status,
          durationMs,
        });
      } else {
        this.logger.info("[n8n] webhook ok", {
          action: label,
          status: response.status,
          durationMs,
        });
      }

      return {
        ok: response.ok,
        status: response.status,
        body,
        parseError,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      if (isTimeout(error)) {
        this.logger.error("[n8n] timeout", { action: label, durationMs });
        throw new N8nClientError(
          `Timeout al llamar a n8n (${this.timeoutMs}ms)`,
          "timeout",
          { cause: error },
        );
      }
      if (error instanceof N8nClientError) throw error;
      this.logger.error("[n8n] red", {
        action: label,
        durationMs,
        reason: error instanceof Error ? error.message : "unknown",
      });
      throw new N8nClientError(
        error instanceof Error ? error.message : "Error de red al llamar a n8n",
        "network",
        { cause: error },
      );
    }
  }

  /** @deprecated Use triggerWebhook. Kept for existing callers. */
  async trigger(
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<WebhookTriggerResult> {
    return this.triggerWebhook(action, payload);
  }

  async notifyLeadCreated(
    lead: Record<string, unknown>,
  ): Promise<WebhookTriggerResult> {
    return this.notifyIfEnabled("lead_created", leadCreatedPayload(lead));
  }

  async notifyLeadUpdated(
    lead: Record<string, unknown>,
    changed: string[] = [],
  ): Promise<WebhookTriggerResult> {
    return this.notifyIfEnabled(
      "lead_updated",
      leadUpdatedPayload(lead, changed),
    );
  }

  async notifyLeadAnalyzed(
    lead: Record<string, unknown>,
    analysis: Record<string, unknown> = {},
  ): Promise<WebhookTriggerResult> {
    return this.notifyIfEnabled(
      "lead_analyzed",
      leadAnalyzedPayload(lead, analysis),
    );
  }

  async testConnection(options?: {
    sendApiKey?: boolean;
  }): Promise<{ ok: boolean; message: string }> {
    const settings = await this.getSettings();
    const baseUrl = settings.n8n.baseUrl.value.replace(/\/+$/, "");
    const apiKey = settings.n8n.apiKey.value;

    if (!baseUrl) {
      const hasWebhook = Object.values(settings.n8n.webhooks).some((w) => w.value);
      if (hasWebhook) {
        return {
          ok: true,
          message:
            "Webhooks configurados. Sin URL base no se puede comprobar el servicio n8n.",
        };
      }
      throw new N8nClientError(
        "Configura la URL base de n8n o al menos un webhook",
        "not_configured",
      );
    }

    this.assertOutboundUrl(baseUrl);
    const healthUrl = `${baseUrl}/healthz`;
    const started = Date.now();
    const sendApiKey = options?.sendApiKey !== false;
    try {
      const health = await this.fetchFn(healthUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const durationMs = Date.now() - started;
      if (!health.ok) {
        this.logger.warn("[n8n] healthz", { status: health.status, durationMs });
        throw new N8nClientError(
          `n8n respondió HTTP ${health.status} en /healthz`,
          "http",
          { status: health.status },
        );
      }

      if (apiKey && sendApiKey) {
        const workflows = await this.fetchFn(`${baseUrl}/api/v1/workflows?limit=1`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-N8N-API-KEY": apiKey,
          },
          redirect: "manual",
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!workflows.ok) {
          throw new N8nClientError(
            `La API key de n8n fue rechazada (HTTP ${workflows.status})`,
            "http",
            { status: workflows.status },
          );
        }
        return { ok: true, message: "n8n reachable y API key válida" };
      }

      if (apiKey && !sendApiKey) {
        return {
          ok: true,
          message:
            "n8n reachable (healthz). Guarda la URL antes de comprobar la API key.",
        };
      }

      return { ok: true, message: "n8n reachable (healthz)" };
    } catch (error) {
      if (error instanceof N8nClientError) throw error;
      if (isTimeout(error)) {
        throw new N8nClientError(
          `Timeout al contactar n8n (${this.timeoutMs}ms)`,
          "timeout",
          { cause: error },
        );
      }
      throw new N8nClientError(
        error instanceof Error ? error.message : "No se pudo contactar n8n",
        "network",
        { cause: error },
      );
    }
  }

  private async notifyIfEnabled(
    action: AutomationAction,
    payload: Record<string, unknown>,
  ): Promise<WebhookTriggerResult> {
    const settings = await this.getSettings();
    if (!settings.automations[action].enabled.value) {
      this.logger.info("[n8n] skip (inactiva)", { action });
      return {
        ok: true,
        status: 0,
        body: { skipped: true, action, reason: "inactive" },
        skipped: true,
        durationMs: 0,
      };
    }
    if (!settings.n8n.webhooks[action].value) {
      this.logger.info("[n8n] skip (sin webhook)", { action });
      return {
        ok: true,
        status: 0,
        body: { skipped: true, action, reason: "not_configured" },
        skipped: true,
        durationMs: 0,
      };
    }
    return this.triggerWebhook(action, payload);
  }

  private assertOutboundUrl(value: string): void {
    const error = outboundUrlError(value);
    if (error) {
      throw new N8nClientError(error, "unsafe_url");
    }
  }

  private async resolveUrl(urlOrAction: string): Promise<string | null> {
    const trimmed = urlOrAction.trim();
    if (looksLikeUrl(trimmed)) {
      this.assertOutboundUrl(trimmed);
      return trimmed;
    }
    const stored = await this.getWebhookUrl(trimmed);
    if (stored) this.assertOutboundUrl(stored);
    return stored;
  }
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const code =
    "code" in error ? String((error as { code?: unknown }).code) : "";
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "ABORT_ERR" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

export function createN8nClient(deps?: N8nClientDeps): N8nClient {
  return new N8nClient(deps);
}

export const n8nClient = createN8nClient();
