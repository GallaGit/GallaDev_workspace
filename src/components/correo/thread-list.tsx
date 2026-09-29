"use client";

import { cn } from "@/lib/utils";
import { Mail, MailOpen } from "lucide-react";
import type { EmailThread } from "./inbox-page";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) {
    return date.toLocaleDateString("es-ES", { weekday: "short" });
  }
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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
  return (
    <ul role="listbox" aria-label="Hilos de correo">
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
                    <Mail className="h-4 w-4 text-rojo" aria-label="No leído" />
                  ) : (
                    <MailOpen className="h-4 w-4 text-gris-400 dark:text-gris-500" aria-label="Leído" />
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
                      {formatDate(thread.last_message_at)}
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
                  {thread.message_count > 1 && (
                    <span className="mt-0.5 inline-block rounded-full bg-gris-100 dark:bg-gris-800 px-1.5 text-[10px] text-gris-500 dark:text-gris-400">
                      {thread.message_count} mensajes
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
