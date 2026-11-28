"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSessionAccess } from "@/components/session-access";
import { AuditEntryItem } from "@/components/audit/audit-entry-item";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-diff";
import { readJsonResponse } from "@/lib/http/read-json";
import type { AuditListResponse } from "@/lib/audit/types";

interface Member {
  id: string;
  email: string | null;
}

interface Filters {
  actor: string;
  action: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { actor: "", action: "", from: "", to: "" };
const CONTROL = "rounded-md border border-border bg-bg px-2 py-1 text-sm";

/**
 * Ajustes → Historial. Vista global solo Admin (API + RLS): filtros por
 * usuario, acción y rango de fechas, con paginación.
 */
export function SettingsAuditLog() {
  const t = useTranslations("audit");
  const { isAdmin, ready } = useSessionAccess();
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    let cancelled = false;
    fetch("/api/team")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { members?: Member[] };
        if (!cancelled && Array.isArray(body.members)) setMembers(body.members);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ page: String(page) });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const res = await fetch(`/api/audit?${params.toString()}`);
      setData(await readJsonResponse<AuditListResponse>(res, t("loadError")));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page, t]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y al cambiar filtros/página
    void load();
  }, [ready, isAdmin, load]);

  if (!ready || !isAdmin) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section
      aria-labelledby="historial-heading"
      className="rounded-lg border border-border bg-panel p-4"
    >
      <h3 id="historial-heading" className="text-sm font-semibold text-fg">
        {t("globalTitle")}
      </h3>
      <p className="mt-1 text-sm text-muted-fg">{t("globalDescription")}</p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters(draft);
        }}
      >
        <label className="flex flex-col gap-0.5 text-xs text-muted-fg">
          {t("filterUser")}
          <select
            className={CONTROL}
            value={draft.actor}
            onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
          >
            <option value="">{t("all")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email ?? m.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-fg">
          {t("filterAction")}
          <select
            className={CONTROL}
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
          >
            <option value="">{t("all")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`actions.${a.replace(".", "_")}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-fg">
          {t("filterFrom")}
          <input
            type="date"
            className={CONTROL}
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-fg">
          {t("filterTo")}
          <input
            type="date"
            className={CONTROL}
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
        </label>
        <Button type="submit" size="sm">
          {t("apply")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(EMPTY);
            setFilters(EMPTY);
            setPage(1);
          }}
        >
          {t("clear")}
        </Button>
      </form>

      <div className="mt-3" data-testid="audit-global-list">
        {loading && !data ? (
          <p className="text-sm text-muted-fg">{t("loading")}</p>
        ) : failed || !data ? (
          <p role="alert" className="text-sm text-red-400">
            {t("loadError")}
          </p>
        ) : data.entries.length === 0 ? (
          <p className="text-sm text-muted-fg">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {data.entries.map((entry) => (
              <AuditEntryItem
                key={entry.id}
                entry={entry}
                viewerId={data.viewerId}
                labels={data.labels}
                showEntity
              />
            ))}
          </ul>
        )}
      </div>

      {data && data.total > 0 ? (
        <nav
          aria-label={t("pagination")}
          className="mt-3 flex items-center gap-2 text-xs text-muted-fg"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("prev")}
          </Button>
          <span>{t("pageOf", { page, total: totalPages })}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
