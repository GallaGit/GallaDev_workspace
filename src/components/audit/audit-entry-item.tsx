"use client";

import { useLocale, useTranslations } from "next-intl";
import { auditChangeViews } from "@/lib/audit/format";
import type { AuditEntry } from "@/lib/audit/types";
import type { AuditScalar } from "@/lib/audit/audit-diff";

const KNOWN_ACTIONS = new Set([
  "lead.created",
  "lead.status_changed",
  "lead.reassigned",
  "lead.note_edited",
  "lead.updated",
  "lead.archived",
  "team.role_changed",
  "settings.changed",
  "auth.login",
  "auth.logout",
  "create",
  "update",
  "delete",
  "role_change",
]);

const KNOWN_FIELDS = new Set([
  "status",
  "responsibleId",
  "favorite",
  "archived",
  "score",
  "confidence",
  "lastContact",
  "nextFollowUp",
  "role",
  "ai.provider",
  "ai.model",
  "ai.apiKey",
  "serpapi.apiKey",
  "notes",
  "notesOverflow",
  "email",
  "phone",
]);

export function AuditEntryItem({
  entry,
  viewerId,
  labels,
  showEntity = false,
}: {
  entry: AuditEntry;
  viewerId: string | null;
  labels: Record<string, string>;
  /** En la vista global se indica sobre qué recae el evento. */
  showEntity?: boolean;
}) {
  const t = useTranslations("audit");
  const locale = useLocale();

  const actor =
    entry.actor_id && entry.actor_id === viewerId
      ? t("you")
      : (entry.actor_email ?? t("unknownActor"));
  const action = KNOWN_ACTIONS.has(entry.action)
    ? t(`actions.${entry.action.replace(".", "_")}`)
    : entry.action;

  function value(field: string, v: AuditScalar | undefined): string {
    if (v === null || v === undefined || v === "") return t("emptyValue");
    if (typeof v === "boolean") return v ? t("yes") : t("no");
    if (field === "responsibleId" && typeof v === "string") {
      if (v === viewerId) return t("you");
      return labels[v] ?? t("anotherPerson");
    }
    return String(v);
  }

  const changes = auditChangeViews(entry);
  const target =
    entry.entity === "profile" && labels[entry.entity_id]
      ? labels[entry.entity_id]
      : null;

  return (
    <li
      data-testid="audit-entry"
      className="border-l-2 border-(--border) pl-2 text-[12px]"
    >
      <div className="text-[10px] text-(--muted-fg)">
        <time dateTime={entry.created_at}>
          {new Date(entry.created_at).toLocaleString(locale)}
        </time>
        {entry.actor_role ? ` · ${entry.actor_role}` : ""}
        {showEntity && entry.entity === "lead" && entry.lead_id
          ? ` · ${t("entityLead")} ${entry.lead_id.slice(0, 8)}`
          : ""}
      </div>
      <div className="text-(--fg)">
        <span className="font-medium">{actor}</span> · {action}
        {target ? <span className="text-(--muted-fg)"> ({target})</span> : null}
      </div>
      {changes.length > 0 ? (
        <ul className="mt-0.5 space-y-0.5 text-[11.5px] text-(--muted-fg)">
          {changes.map((c) => (
            <li key={c.field}>
              {KNOWN_FIELDS.has(c.field) ? t(`fields.${c.field.replace(".", "_")}`) : c.field}
              {c.hasValues ? (
                <>
                  : {value(c.field, c.from)} → {value(c.field, c.to)}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
