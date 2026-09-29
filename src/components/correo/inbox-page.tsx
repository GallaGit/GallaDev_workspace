"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { ThreadList } from "@/components/correo/thread-list";
import { ThreadView } from "@/components/correo/thread-view";
import { Skeleton } from "@/components/ui/skeleton";

export interface EmailThread {
  id: string;
  subject: string;
  from_address: string;
  from_name: string | null;
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

export function InboxPage() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/email/threads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar hilos");
      setThreads(data.threads ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar el buzón");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  const handleMarkRead = useCallback(
    (threadId: string) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, is_read: true } : t)),
      );
    },
    [],
  );

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
      <Topbar title="Correo" subtitle="hola@galladev.com" />
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito">
          <div className="border-b border-gris-200 dark:border-gris-700 px-3 py-2 text-[11px] text-gris-500 dark:text-gris-400">
            Bandeja de entrada · {threads.length} hilos
          </div>
          {loading ? (
            <div className="space-y-3 p-3">
              <Skeleton variant="card" lines={3} />
              <Skeleton variant="card" lines={3} />
              <Skeleton variant="card" lines={3} />
            </div>
          ) : threads.length === 0 ? (
            <p className="p-4 text-[13px] text-gris-500 dark:text-gris-400">
              No hay correos. Los mensajes a hola@galladev.com aparecerán aquí.
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
