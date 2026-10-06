"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Mail, MailOpen } from "lucide-react";
import { mailboxChipLabel } from "@/lib/email/mailboxes";
import type { EmailThread } from "./inbox-page";

function formatDate(iso: string, locale: string, yesterday: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return yesterday;
  if (diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: "short" });
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: EmailThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("correo");
  const locale = useLocale();

  return (
    <ul role="listbox" aria-label={t("threadList")}>
      {threads.map((thread) => {
        const active = thread.id === selectedId;
        const unread = !thread.is_read;
        return (
          <li key={thread.id} role="option" aria-selected={active}>
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              className={cn(
                "w-full border-b border-gris-200 dark:border-gris-700 px-3 py-2.5 text-left transition-colors",
                active
                  ? "bg-rojo/5 dark:bg-rojo/10"
                  : "hover:bg-gris-50 dark:hover:bg-gris-800",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {unread ? (
                    <Mail className="h-4 w-4 text-rojo" aria-label={t("unread")} />
                  ) : (
                    <MailOpen className="h-4 w-4 text-gris-400 dark:text-gris-500" aria-label={t("read")} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[13px]",
                        unread
                          ? "font-semibold text-grafito dark:text-gris-100"
                          : "font-medium text-gris-600 dark:text-gris-300",
                      )}
                    >
                      {thread.from_name ?? thread.from_address}
                    </span>
                    <span className="shrink-0 text-[11px] text-gris-500 dark:text-gris-400">
                      {formatDate(thread.last_message_at, locale, t("yesterday"))}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[12px]",
                      unread
                        ? "text-grafito dark:text-gris-200"
                        : "text-gris-500 dark:text-gris-400",
                    )}
                  >
                    {thread.subject}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className="inline-block rounded bg-gris-100 dark:bg-gris-800 px-1.5 text-[10px] font-medium text-gris-600 dark:text-gris-300">
                      {mailboxChipLabel(thread.mailbox_address || "hola@galladev.com")}
                    </span>
                    {thread.message_count > 1 && (
                      <span className="inline-block rounded-full bg-gris-100 dark:bg-gris-800 px-1.5 text-[10px] text-gris-500 dark:text-gris-400">
                        {t("messageCount", { count: thread.message_count })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
