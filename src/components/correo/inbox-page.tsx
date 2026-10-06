"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { readJsonResponse } from "@/lib/http/read-json";

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

function formatDraftDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

export function InboxPage() {
  const t = useTranslations("correo");
  const locale = useLocale();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailboxFilter, setMailboxFilter] = useState<MailboxFilter>("all");
  const [listMode, setListMode] = useState<ListMode>("threads");
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<EmailDraft | null>(null);
  const [threadsReloadKey, setThreadsReloadKey] = useState(0);

  const filterOptions: { id: MailboxFilter; label: string }[] = [
    { id: "all", label: t("all") },
    ...COMPANY_MAILBOXES.map((m) => ({
      id: m as MailboxFilter,
      label: m.split("@")[0] + "@",
    })),
  ];

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
        const data = await readJsonResponse<{ threads?: EmailThread[] }>(
          res,
          t("loadThreadsError"),
        );
        if (cancelled) return;
        setThreads(data.threads ?? []);
        setSelectedId(null);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : t("loadMailboxError"),
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
  }, [mailboxFilter, listMode, threadsReloadKey, t]);

  useEffect(() => {
    if (listMode !== "drafts") return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/email/drafts");
        const data = await readJsonResponse<{ drafts?: EmailDraft[] }>(
          res,
          t("loadDraftsError"),
        );
        if (cancelled) return;
        let list = data.drafts ?? [];
        if (mailboxFilter !== "all") {
          list = list.filter((d) => d.mailbox_address === mailboxFilter);
        }
        setDrafts(list);
        setSelectedId(null);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : t("loadDraftsError"),
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
  }, [listMode, mailboxFilter, composeOpen, t]);

  const handleMarkRead = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, is_read: true } : thread,
      ),
    );
  }, []);

  const handleLinkLead = useCallback(
    (threadId: string, leadId: string | null) => {
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId ? { ...thread, lead_id: leadId } : thread,
        ),
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

  const handleDeleteDraft = useCallback(
    async (draftId: string) => {
      try {
        const res = await fetch(`/api/email/drafts/${draftId}`, {
          method: "DELETE",
        });
        await readJsonResponse(res, t("deleteError"));
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        toast.success(t("draftDeleted"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("deleteError"));
      }
    },
    [t],
  );

  const selectedThread = threads.find((thread) => thread.id === selectedId) ?? null;

  return (
    <>
      <Topbar title={t("title")} subtitle={t("subtitle")} />
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
              {t("new")}
            </Button>
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label={t("mailboxFilter")}
            >
              {filterOptions.map((opt) => {
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
                {t("drafts")}
              </button>
            </div>
            <p className="text-[11px] text-gris-500 dark:text-gris-400">
              {listMode === "drafts"
                ? t("draftCount", { count: drafts.length })
                : t("threadCount", { count: threads.length })}
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
                {t("emptyDrafts")}
              </p>
            ) : (
              <ul role="listbox" aria-label={t("drafts")}>
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
                            {draft.to_address || t("noRecipient")}
                          </span>
                          <span className="shrink-0 text-[11px] text-gris-500">
                            {formatDraftDate(draft.updated_at, locale)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-gris-500 dark:text-gris-400">
                          {draft.subject || t("noSubject")}
                        </p>
                        <span className="mt-0.5 inline-block rounded bg-gris-100 dark:bg-gris-800 px-1.5 text-[10px] font-medium text-gris-600 dark:text-gris-300">
                          {mailboxChipLabel(draft.mailbox_address)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 p-2 text-gris-400 hover:text-rojo"
                        aria-label={t("deleteDraft")}
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
              {mailboxFilter === "all"
                ? t("emptyAll")
                : t("emptyMailbox", { mailbox: mailboxFilter })}
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
                {t("openDraftHint")}
              </p>
            </div>
          ) : !selectedThread ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gris-500 dark:text-gris-400">
                {t("selectThread")}
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
