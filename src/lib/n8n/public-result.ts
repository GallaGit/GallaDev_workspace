import type { WebhookTriggerResult } from "./client";

/** Lo que ve el navegador: código y duración, sin cuerpo remoto. */
export function toClientWebhookResult(result: WebhookTriggerResult): {
  ok: boolean;
  status: number;
  durationMs: number;
  skipped?: boolean;
} {
  return {
    ok: result.ok,
    status: result.status,
    durationMs: result.durationMs,
    ...(result.skipped ? { skipped: true } : {}),
  };
}
