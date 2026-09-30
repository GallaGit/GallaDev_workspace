"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { ThreadList } from "@/components/correo/thread-list";
import { ThreadView } from "@/components/correo/thread-view";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  COMPANY_MAILBOXES,
  type CompanyMailbox,
} from "@/lib/email/mailboxes";

export interface EmailThread {
  id: string;
  subject: string;
  from_address: string;
  from_name: string | null;
  mailbox_address: string;
  last_message_at: string;
  is_read: boolean;
  message_count: number;
  lead_id: string | null;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  resend_email_id: string;
  message_id: string | null;
  direction: "inbound" | "outbound";
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  send_status: string;
  received_at: string;
  created_at: string;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size_bytes: number | null;
}

type MailboxFilter = "all" | CompanyMailbox;

const FILTER_OPTIONS: { id: MailboxFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  ...COMPANY_MAILBOXES.map((m) => ({
    id: m as MailboxFilter,
    label: m.split("@")[0] + "@",
  })),
];

export function InboxPage() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailboxFilter, setMailboxFilter] = useState<MailboxFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (mailboxFilter !== "all") {
          params.set("mailbox", mailboxFilter);
        }
        const qs = params.toString();
        const res = await fetch(
          qs ? `/api/email/threads?${qs}` : "/api/email/threads",
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Error al cargar hilos");
        setThreads(data.threads ?? []);
        setSelectedId(null);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Error al cargar el buzón");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mailboxFilter]);

  const handleMarkRead = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, is_read: true } : t)),
    );
  }, []);

  const handleLinkLead = useCallback(
    (threadId: string, leadId: string | null) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, lead_id: leadId } : t)),
      );
    },
    [],
  );

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <Topbar title="Correo" subtitle="hola@ · ociel@" />
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito">
          <div className="border-b border-gris-200 dark:border-gris-700 px-3 py-2">
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Filtrar por buzón"
            >
              {FILTER_OPTIONS.map((opt) => {
                const active = mailboxFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMailboxFilter(opt.id)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] transition-colors",
                      active
                        ? "bg-rojo/10 font-semibold text-rojo"
                        : "text-gris-500 hover:bg-gris-100 dark:text-gris-400 dark:hover:bg-gris-800",
                    )}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-gris-500 dark:text-gris-400">
              Hilos · {threads.length}
            </p>
          </div>
          {loading ? (
            <div className="space-y-3 p-3">
              <Skeleton variant="card" lines={3} />
              <Skeleton variant="card" lines={3} />
              <Skeleton variant="card" lines={3} />
            </div>
          ) : threads.length === 0 ? (
            <p className="p-4 text-[13px] text-gris-500 dark:text-gris-400">
              No hay correos
              {mailboxFilter === "all"
                ? " para hola@ u ociel@."
                : ` en ${mailboxFilter}.`}
            </p>
          ) : (
            <ThreadList
              threads={threads}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!selectedThread ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gris-500 dark:text-gris-400">
                Selecciona un hilo para leer los mensajes.
              </p>
            </div>
          ) : (
            <ThreadView
              thread={selectedThread}
              onMarkRead={handleMarkRead}
              onLinkLead={handleLinkLead}
            />
          )}
        </div>
      </div>
    </>
  );
}
