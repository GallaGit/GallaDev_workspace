"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSessionAccess } from "@/components/session-access";
import type { AppRole } from "@/lib/auth";

interface Member {
  id: string;
  email: string | null;
  role: string | null;
}

const ROLES: AppRole[] = ["Admin", "Seller", "Viewer"];

/**
 * Settings → Equipo. Solo Admin. Asigna el rol de las cuentas nuevas
 * (nacen sin rol) y puede cambiar el de las existentes.
 */
export function SettingsTeam() {
  const t = useTranslations("settings");
  const { isAdmin, ready } = useSessionAccess();
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState<Record<string, AppRole | "">>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    let cancelled = false;
    fetch("/api/team")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { members?: Member[] };
        if (cancelled || !Array.isArray(data.members)) return;
        setMembers(data.members);
      })
      .catch(() => {
        if (!cancelled) setError(t("teamPanel.loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, ready, t]);

  if (!ready || !isAdmin) return null;

  async function save(member: Member) {
    const role = draft[member.id];
    if (!role) return;
    setSavingId(member.id);
    setError(null);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, role }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || t("teamPanel.roleError"));
        return;
      }
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, role } : item)),
      );
      setDraft((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
    } catch {
      setError(t("teamPanel.networkError"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section aria-labelledby="equipo-heading" className="rounded-lg border border-border bg-panel p-4">
      <h3 id="equipo-heading" className="text-sm font-semibold text-fg">
        {t("team")}
      </h3>
      <p className="mt-1 text-sm text-muted-fg">{t("teamPanel.description")}</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {members.length === 0 ? (
          <li className="text-sm text-muted-fg">{t("teamPanel.empty")}</li>
        ) : (
          members.map((member) => {
            const current = (draft[member.id] || member.role || "") as AppRole | "";
            const dirty = Boolean(draft[member.id] && draft[member.id] !== member.role);
            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {member.email ?? member.id}
                </span>
                <span className="text-xs text-muted-fg">
                  {member.role ?? t("teamPanel.pending")}
                </span>
                <label className="sr-only" htmlFor={`role-${member.id}`}>
                  {t("teamPanel.roleOf", { member: member.email ?? member.id })}
                </label>
                <select
                  id={`role-${member.id}`}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
                  value={current}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      [member.id]: event.target.value as AppRole,
                    }))
                  }
                >
                  <option value="" disabled>
                    {t("teamPanel.chooseRole")}
                  </option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || savingId === member.id}
                  onClick={() => void save(member)}
                >
                  {t("teamPanel.save")}
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
