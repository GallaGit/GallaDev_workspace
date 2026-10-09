"use client";

import { useLocale, useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { mailboxChipLabel } from "@/lib/email/mailboxes";
import { formatThreadDate } from "@/lib/email/thread-state";
import type { EmailThread } from "./inbox-page";

/**
 * Lista densa tipo Gmail: una fila por hilo con casilla, remitente, fecha,
 * clip si hay adjuntos, asunto y fragmento del último mensaje.
 * Negrita si el hilo no está leído.
 */
export function ThreadList({
  threads,
  selectedId,
  onSelect,
  checkedIds,
  onToggleChecked,
}: {
  threads: EmailThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  checkedIds?: ReadonlySet<string>;
  onToggleChecked?: (id: string) => void;
}) {
  const t = useTranslations("correo");
  const locale = useLocale();

  return (
    <ul role="listbox" aria-label={t("threadList")}>
      {threads.map((thread) => {
        const active = thread.id === selectedId;
        const unread = !thread.is_read;
        const checked = checkedIds?.has(thread.id) ?? false;
        const sender = thread.from_name || thread.from_address;
        return (
          <li
            key={thread.id}
            role="option"
            aria-selected={active}
            data-unread={unread ? "true" : undefined}
            className={cn(
              "flex items-start border-b border-gris-200 dark:border-gris-700 transition-colors",
              active
                ? "bg-rojo/5 dark:bg-rojo/10"
                : checked
                  ? "bg-gris-50 dark:bg-gris-800"
                  : "hover:bg-gris-50 dark:hover:bg-gris-800",
            )}
          >
            {onToggleChecked ? (
              <label className="flex shrink-0 cursor-pointer items-center py-3 pl-3 pr-1">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-rojo"
                  checked={checked}
                  onChange={() => onToggleChecked(thread.id)}
                  aria-label={t("selectThreadRow", { sender })}
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              className="min-w-0 flex-1 px-2 py-2.5 text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {unread ? (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-rojo"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      unread
                        ? "font-semibold text-grafito dark:text-gris-100"
                        : "font-normal text-gris-600 dark:text-gris-300",
                    )}
                  >
                    {sender}
                  </span>
                  {thread.message_count > 1 && (
                    <span className="shrink-0 text-[11px] text-gris-500 dark:text-gris-400">
                      {thread.message_count}
                    </span>
                  )}
                  <span className="sr-only">
                    {unread ? t("unread") : t("read")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {thread.has_attachments ? (
                    <Paperclip
                      className="h-3 w-3 text-gris-500 dark:text-gris-400"
                      aria-label={t("hasAttachments")}
                      role="img"
                    />
                  ) : null}
                  <time
                    dateTime={thread.last_message_at}
                    className={cn(
                      "text-[11px]",
                      unread
                        ? "font-semibold text-grafito dark:text-gris-100"
                        : "text-gris-500 dark:text-gris-400",
                    )}
                  >
                    {formatThreadDate(thread.last_message_at, locale, {
                      yesterday: t("yesterday"),
                    })}
                  </time>
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-[12px]",
                  unread
                    ? "font-semibold text-grafito dark:text-gris-100"
                    : "text-gris-600 dark:text-gris-300",
                )}
              >
                {thread.subject || t("noSubject")}
              </p>
              {thread.last_snippet ? (
                <p className="mt-0.5 truncate text-[12px] text-gris-500 dark:text-gris-400">
                  {thread.last_snippet}
                </p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="inline-block rounded bg-gris-100 dark:bg-gris-800 px-1.5 text-[10px] font-medium text-gris-600 dark:text-gris-300">
                  {mailboxChipLabel(thread.mailbox_address || "hola@galladev.com")}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
