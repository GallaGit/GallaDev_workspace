"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/http/read-json";
import { formatThreadDate } from "@/lib/email/thread-state";

export interface LeadEmailThread {
  id: string;
  subject: string;
  last_message_at: string;
  last_snippet?: string | null;
  is_read: boolean;
  message_count: number;
}

const MAX_THREADS = 20;

/**
 * Sección «Correos» de la ficha del lead: hilos del Correo vinculados a él.
 * El Correo es solo para Admin (API + RLS); quien no tenga acceso no debe
 * montar este componente. `canUnlink` controla el botón de desvincular.
 */
export function LeadEmailsSection({
  leadId,
  canUnlink = false,
}: {
  leadId: string;
  canUnlink?: boolean;
}) {
  const t = useTranslations("leads.emails");
  const locale = useLocale();
  const [threads, setThreads] = useState<LeadEmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({
          lead_id: leadId,
          limit: String(MAX_THREADS),
        });
        const res = await fetch(`/api/email/threads?${params.toString()}`);
        const data = await readJsonResponse<{ threads?: LeadEmailThread[] }>(
          res,
          t("loadError"),
        );
        if (cancelled) return;
        setThreads(data.threads ?? []);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId, t]);

  const unlink = useCallback(
    async (threadId: string) => {
      setUnlinking(threadId);
      try {
        const res = await fetch(`/api/email/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: null }),
        });
        await readJsonResponse(res, t("unlinkError"));
        setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
        toast.success(t("unlinked"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("unlinkError"));
      } finally {
        setUnlinking(null);
      }
    },
    [t],
  );

  return (
    <section data-testid="lead-emails-section">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg)">
        {t("title")}
      </h3>
      {loading ? (
        <p className="text-[12px] text-(--muted-fg)">{t("loading")}</p>
      ) : failed ? (
        <p role="alert" className="text-[12px] text-(--muted-fg)">
          {t("loadError")}
        </p>
      ) : threads.length === 0 ? (
        <p className="text-[12px] text-(--muted-fg)">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => {
            const subject = thread.subject.trim() || t("noSubject");
            return (
              <li
                key={thread.id}
                className="rounded-md border border-(--border) px-2 py-1.5 text-[12.5px]"
              >
                <div className="flex items-start gap-2">
                  <Link
                    href={`/correo?thread=${thread.id}`}
                    title={t("open")}
                    className={`min-w-0 flex-1 truncate hover:underline ${
                      thread.is_read ? "text-(--fg)" : "font-semibold text-(--fg)"
                    }`}
                  >
                    {subject}
                  </Link>
                  <ExternalLink
                    className="mt-0.5 h-3 w-3 shrink-0 text-(--muted-fg)"
                    aria-hidden
                  />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-(--muted-fg)">
                  {!thread.is_read ? (
                    <span className="rounded bg-rojo/10 px-1 text-rojo">
                      {t("unread")}
                    </span>
                  ) : null}
                  <time dateTime={thread.last_message_at}>
                    {formatThreadDate(thread.last_message_at, locale, {
                      yesterday: t("yesterday"),
                    })}
                  </time>
                  <span>{t("messageCount", { count: thread.message_count })}</span>
                  {canUnlink ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 px-1.5 text-[11px]"
                      disabled={unlinking === thread.id}
                      aria-label={t("unlinkAria", { subject })}
                      onClick={() => void unlink(thread.id)}
                    >
                      <Unlink className="mr-1 h-3 w-3" aria-hidden />
                      {t("unlink")}
                    </Button>
                  ) : null}
                </div>
                {thread.last_snippet ? (
                  <p className="mt-0.5 truncate text-[11.5px] text-(--muted-fg)">
                    {thread.last_snippet}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
