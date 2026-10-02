import { AUTOMATION_ACTION_IDS } from "./types";
import type { ResolvedSettings } from "./types";

/** Nombres de campo cuyo valor de URL cambió. Nunca incluye la URL. */
export function webhookAuditChanges(
  before: ResolvedSettings,
  after: ResolvedSettings,
): string[] {
  const changed: string[] = [];
  if (before.n8n.baseUrl.value !== after.n8n.baseUrl.value) {
    changed.push("n8n.baseUrl");
  }
  for (const action of AUTOMATION_ACTION_IDS) {
    if (before.n8n.webhooks[action].value !== after.n8n.webhooks[action].value) {
      changed.push(`n8n.webhooks.${action}`);
    }
  }
  return changed;
}
