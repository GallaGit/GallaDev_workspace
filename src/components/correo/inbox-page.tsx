"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PenSquare, Trash2 } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { ThreadList } from "@/components/correo/thread-list";
import { ThreadView } from "@/components/correo/thread-view";
import {
  ComposeDialog,
  type EmailDraft,
} from "@/components/correo/compose-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  COMPANY_MAILBOXES,
  mailboxChipLabel,
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

type ListMode = "threads" | "drafts";
type MailboxFilter = "all" | CompanyMailbox;

const FILTER_OPTIONS: { id: MailboxFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  ...COMPANY_MAILBOXES.map((m) => ({
    id: m as MailboxFilter,
    label: m.split("@")[0] + "@",
  })),
];

function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function InboxPage() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailboxFilter, setMailboxFilter] = useState<MailboxFilter>("all");
  const [listMode, setListMode] = useState<ListMode>("threads");
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<EmailDraft | null>(null);
  const [threadsReloadKey, setThreadsReloadKey] = useState(0);

  useEffect(() => {
    if (listMode !== "threads") return;
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
          toast.error(
            e instanceof Error ? e.message : "Error al cargar el buzón",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mailboxFilter, listMode, threadsReloadKey]);

  useEffect(() => {
    if (listMode !== "drafts") return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/email/drafts");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Error al cargar borradores");
        let list = (data.drafts ?? []) as EmailDraft[];
        if (mailboxFilter !== "all") {
          list = list.filter((d) => d.mailbox_address === mailboxFilter);
        }
        setDrafts(list);
        setSelectedId(null);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Error al cargar borradores",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [listMode, mailboxFilter, composeOpen]);

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

  const openNewCompose = useCallback(() => {
    setEditingDraft(null);
    setComposeOpen(true);
  }, []);

  const openDraft = useCallback((draft: EmailDraft) => {
    setEditingDraft(draft);
    setComposeOpen(true);
  }, []);

  const handleDraftSaved = useCallback((draft: EmailDraft) => {
    setEditingDraft(draft);
    setDrafts((prev) => {
      const without = prev.filter((d) => d.id !== draft.id);
      return [draft, ...without];
    });
    setListMode("drafts");
  }, []);

  const handleSent = useCallback((threadId: string) => {
    setEditingDraft(null);
    setListMode("threads");
    setThreadsReloadKey((k) => k + 1);
    setSelectedId(threadId);
  }, []);

  const handleDeleteDraft = useCallback(async (draftId: string) => {
    try {
      const res = await fetch(`/api/email/drafts/${draftId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success("Borrador eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  }, []);

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <Topbar title="Correo" subtitle="hola@ · ociel@" />
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito">
          <div className="border-b border-gris-200 dark:border-gris-700 px-3 py-2 space-y-2">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={openNewCompose}
            >
              <PenSquare className="mr-1.5 h-3.5 w-3.5" />
              Nuevo
            </Button>
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Filtrar por buzón"
            >
              {FILTER_OPTIONS.map((opt) => {
                const active =
                  listMode === "threads" && mailboxFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setListMode("threads");
                      setMailboxFilter(opt.id);
                    }}
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
              <button
                type="button"
                onClick={() => setListMode("drafts")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] transition-colors",
                  listMode === "drafts"
                    ? "bg-rojo/10 font-semibold text-rojo"
                    : "text-gris-500 hover:bg-gris-100 dark:text-gris-400 dark:hover:bg-gris-800",
                )}
                aria-pressed={listMode === "drafts"}
              >
                Borradores
              </button>
            </div>
            <p className="text-[11px] text-gris-500 dark:text-gris-400">
              {listMode === "drafts"
                ? `Borradores · ${drafts.length}`
                : `Hilos · ${threads.length}`}
            </p>
          </div>

          {loading ? (
            <div className="space-y-3 p-3">
              <Skeleton variant="card" lines={3} />
              <Skeleton variant="card" lines={3} />
              <Skeleton variant="card" lines={3} />
            </div>
          ) : listMode === "drafts" ? (
            drafts.length === 0 ? (
              <p className="p-4 text-[13px] text-gris-500 dark:text-gris-400">
                No hay borradores. Usa Nuevo para redactar.
              </p>
            ) : (
              <ul role="listbox" aria-label="Borradores">
                {drafts.map((draft) => (
                  <li key={draft.id}>
                    <div className="flex items-start gap-1 border-b border-gris-200 dark:border-gris-700">
                      <button
                        type="button"
                        className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-gris-50 dark:hover:bg-gris-800"
                        onClick={() => openDraft(draft)}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-grafito dark:text-gris-100">
                            {draft.to_address || "(sin destinatario)"}
                          </span>
                          <span className="shrink-0 text-[11px] text-gris-500">
                            {formatDraftDate(draft.updated_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-gris-500 dark:text-gris-400">
                          {draft.subject || "(sin asunto)"}
                        </p>
                        <span className="mt-0.5 inline-block rounded bg-gris-100 dark:bg-gris-800 px-1.5 text-[10px] font-medium text-gris-600 dark:text-gris-300">
                          {mailboxChipLabel(draft.mailbox_address)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 p-2 text-gris-400 hover:text-rojo"
                        aria-label="Eliminar borrador"
                        onClick={() => void handleDeleteDraft(draft.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
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
          {listMode === "drafts" ? (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-sm text-gris-500 dark:text-gris-400">
                Abre un borrador o pulsa Nuevo para redactar.
              </p>
            </div>
          ) : !selectedThread ? (
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

      <ComposeDialog
        key={editingDraft?.id ?? (composeOpen ? "new" : "closed")}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultMailboxAddress={mailboxFilter}
        initialDraft={editingDraft}
        onSent={handleSent}
        onDraftSaved={handleDraftSaved}
      />
    </>
  );
}
