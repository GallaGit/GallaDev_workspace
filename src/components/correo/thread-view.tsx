"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link2, Paperclip, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkLeadDialog } from "@/components/correo/link-lead-dialog";
import { ReplyForm } from "@/components/correo/reply-form";
import { cn } from "@/lib/utils";
import { emailHtmlSrcDoc } from "@/lib/email/email-srcdoc";
import { readJsonResponse } from "@/lib/http/read-json";
import type { EmailThread, EmailMessage, EmailAttachment } from "./inbox-page";

/**
 * HTML ya saneado en servidor, dentro de un iframe sin scripts.
 * El sandbox vacío no concede allow-scripts ni allow-same-origin.
 */
export function EmailHtmlFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Contenido del correo"
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={emailHtmlSrcDoc(html)}
      className="mt-4 h-80 w-full rounded-md border border-gris-200 bg-white dark:border-gris-700"
    />
  );
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ThreadView({
  thread,
  onMarkRead,
  onLinkLead,
}: {
  thread: EmailThread;
  onMarkRead: (threadId: string) => void;
  onLinkLead: (threadId: string, leadId: string | null) => void;
}) {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const markedRef = useRef(false);

  const fetchThread = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/threads/${thread.id}`);
      const data = await readJsonResponse<{
        messages?: EmailMessage[];
        attachments?: EmailAttachment[];
      }>(res, "Error al cargar hilo");
      setMessages(data.messages ?? []);
      setAttachments(data.attachments ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar hilo");
    } finally {
      setLoading(false);
    }
  }, [thread.id]);

  useEffect(() => {
    let cancelled = false;
    markedRef.current = false;
    async function load() {
      try {
        const res = await fetch(`/api/email/threads/${thread.id}`);
        const data = await readJsonResponse<{
          messages?: EmailMessage[];
          attachments?: EmailAttachment[];
        }>(res, "Error al cargar hilo");
        if (cancelled) return;
        setMessages(data.messages ?? []);
        setAttachments(data.attachments ?? []);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Error al cargar hilo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [thread.id]);

  useEffect(() => {
    if (!loading && !thread.is_read && !markedRef.current) {
      markedRef.current = true;
      void markAsRead(thread.id, onMarkRead);
    }
  }, [loading, thread.is_read, thread.id, onMarkRead]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gris-200 dark:border-gris-700 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-grafito dark:text-gris-100">
            {thread.subject}
          </h2>
          <p className="text-[12px] text-gris-500 dark:text-gris-400">
            De: {thread.from_name ?? thread.from_address}
            {" · "}
            Para: {thread.mailbox_address || "hola@galladev.com"}
            {thread.lead_id && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-rojo/10 px-1.5 text-[11px] text-rojo">
                <Link2 className="h-3 w-3" /> Lead vinculado
              </span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setLinkOpen(true)}>
          <Link2 className="mr-1 h-3.5 w-3.5" />
          {thread.lead_id ? "Cambiar lead" : "Vincular lead"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton variant="card" lines={4} />
            <Skeleton variant="card" lines={4} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gris-500 dark:text-gris-400">
            No hay mensajes en este hilo.
          </p>
        ) : (
          messages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              attachments={attachments.filter((a) => a.message_id === msg.id)}
            />
          ))
        )}
      </div>

      <ReplyForm threadId={thread.id} onSent={fetchThread} />

      <LinkLeadDialog
        key={linkOpen ? "open" : "closed"}
        open={linkOpen}
        onOpenChange={setLinkOpen}
        threadId={thread.id}
        currentLeadId={thread.lead_id}
        onLinked={(leadId) => onLinkLead(thread.id, leadId)}
      />
    </div>
  );
}

function MessageCard({
  message,
  attachments,
}: {
  message: EmailMessage;
  attachments: EmailAttachment[];
}) {
  const isOutbound = message.direction === "outbound";

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isOutbound
          ? "border-rojo/20 bg-rojo/5 dark:border-rojo/30 dark:bg-rojo/10"
          : "border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-grafito dark:text-gris-100">
            {message.from_name ?? message.from_address}
          </span>
          {isOutbound && (
            <span className="rounded bg-rojo/10 px-1.5 text-[10px] font-medium text-rojo">
              Enviado
            </span>
          )}
          {message.send_status === "failed" && (
            <span className="rounded bg-error/10 px-1.5 text-[10px] font-medium text-error">
              Falló
            </span>
          )}
        </div>
        <span className="text-[11px] text-gris-500 dark:text-gris-400">
          {formatFullDate(message.received_at)}
        </span>
      </div>

      <div className="flex items-start gap-1 text-[11px] text-gris-500 dark:text-gris-400 mb-3">
        <span>Para: {message.to_addresses.join(", ")}</span>
        {message.cc_addresses.length > 0 && (
          <span className="ml-2">CC: {message.cc_addresses.join(", ")}</span>
        )}
      </div>

      {message.body_html ? (
        <div className="relative">
          <div className="absolute -top-1 right-0 flex items-center gap-1 text-[10px] text-gris-400">
            <Shield className="h-3 w-3" />
            HTML saneado
          </div>
          <EmailHtmlFrame html={message.body_html} />
        </div>
      ) : message.body_text ? (
        <pre className="whitespace-pre-wrap text-[13px] text-grafito dark:text-gris-200 font-sans">
          {message.body_text}
        </pre>
      ) : (
        <p className="text-[13px] text-gris-400 italic">
          Sin contenido de texto disponible.
        </p>
      )}

      {attachments.length > 0 && (
        <div className="mt-3 border-t border-gris-200 dark:border-gris-700 pt-2">
          <p className="mb-1 text-[11px] font-medium text-gris-500 dark:text-gris-400">
            <Paperclip className="mr-1 inline h-3 w-3" />
            {attachments.length} adjunto{attachments.length !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1 rounded border border-gris-200 dark:border-gris-700 bg-gris-50 dark:bg-gris-800 px-2 py-1 text-[11px] text-gris-600 dark:text-gris-300"
                title={`${att.content_type}${att.size_bytes ? ` · ${(att.size_bytes / 1024).toFixed(0)} KB` : ""}`}
              >
                {att.filename}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function markAsRead(
  threadId: string,
  onMarkRead: (id: string) => void,
): Promise<void> {
  try {
    const res = await fetch(`/api/email/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
    await readJsonResponse(res, "No se pudo marcar como leído");
    onMarkRead(threadId);
  } catch {
    // No es crítico; al recargar se volverá a intentar.
  }
}
