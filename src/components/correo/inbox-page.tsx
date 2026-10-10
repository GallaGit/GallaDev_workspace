"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { ThreadStatePatch } from "@/lib/email/email-payload";
import {
  THREAD_VIEWS,
  TRASH_RETENTION_DAYS,
  applyThreadPatch,
  formatUnreadBadge,
  stateToastKey,
  threadViewOf,
  type ThreadView as MailView,
} from "@/lib/email/thread-state";
import { BulkToolbar } from "@/components/correo/thread-actions";
import {
  SEARCH_DEBOUNCE_MS,
  SearchBox,
  useDebouncedValue,
} from "@/components/correo/search-box";
import {
  notifyUnreadChanged,
  useUnreadCounts,
} from "@/components/correo/use-unread-counts";

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
  archived_at?: string | null;
  trashed_at?: string | null;
  last_snippet?: string | null;
  has_attachments?: boolean;
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
  const [view, setView] = useState<MailView>("inbox");
  const [searchInput, setSearchInput] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const searchQuery = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const searching = searchQuery.length > 0;
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const threadsRef = useRef<EmailThread[]>([]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  const { counts } = useUnreadCounts(
    true,
    mailboxFilter === "all" ? null : mailboxFilter,
  );

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
        params.set("view", view);
        if (searchQuery) {
          params.set("q", searchQuery);
          if (searchAll) params.set("scope", "all");
        }
        if (mailboxFilter !== "all") {
          params.set("mailbox", mailboxFilter);
        }
        const res = await fetch(`/api/email/threads?${params.toString()}`);
        const data = await readJsonResponse<{ threads?: EmailThread[] }>(
          res,
          t("loadThreadsError"),
        );
        if (cancelled) return;
        setThreads(data.threads ?? []);
        setSelectedId(null);
        setCheckedIds(new Set());
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
  }, [mailboxFilter, listMode, threadsReloadKey, view, searchQuery, searchAll, t]);

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
    notifyUnreadChanged();
  }, []);

  /**
   * Leído/no leído, archivar, papelera y restaurar sobre uno o varios hilos.
   * Optimista: actualiza la lista y la deshace si la API falla.
   */
  const applyState = useCallback(
    async (ids: string[], patch: ThreadStatePatch) => {
      if (ids.length === 0) return;
      const previous = threadsRef.current;
      const idSet = new Set(ids);
      const now = new Date();
      const next = previous
        .map((thread) =>
          idSet.has(thread.id) ? applyThreadPatch(thread, patch, now) : thread,
        )
        // En «buscar en todas las bandejas» las filas se quedan aunque cambien de vista.
        .filter(
          (thread) => (searching && searchAll) || threadViewOf(thread) === view,
        );
      const stillVisible = new Set(next.map((thread) => thread.id));
      threadsRef.current = next;
      setThreads(next);
      setCheckedIds((prev) => {
        const kept = new Set<string>();
        prev.forEach((id) => {
          if (stillVisible.has(id)) kept.add(id);
        });
        return kept;
      });
      setSelectedId((current) => {
        if (!current || !idSet.has(current)) return current;
        // Como Gmail: marcar no leído o sacar el hilo de la vista lo cierra.
        if (!stillVisible.has(current) || patch.is_read === false) return null;
        return current;
      });

      try {
        const res = await fetch("/api/email/threads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, ...patch }),
        });
        await readJsonResponse(res, t("actionError"));
        const toastKey = stateToastKey(patch);
        if (toastKey) toast.success(t(toastKey, { count: ids.length }));
      } catch (e) {
        threadsRef.current = previous;
        setThreads(previous);
        toast.error(e instanceof Error ? e.message : t("actionError"));
      } finally {
        notifyUnreadChanged();
      }
    },
    [view, searching, searchAll, t],
  );

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  const checkedList = useMemo(
    () => threads.filter((th) => checkedIds.has(th.id)).map((th) => th.id),
    [threads, checkedIds],
  );
  const allChecked = threads.length > 0 && checkedList.length === threads.length;
  const someChecked = checkedList.length > 0 && !allChecked;
  const viewLabels: Record<MailView, string> = {
    inbox: t("views.inbox"),
    archived: t("views.archived"),
    trash: t("views.trash"),
  };
  const emptyText = searching
    ? t("search.noResults", { query: searchQuery })
    :
    view === "archived"
      ? t("emptyArchived")
      : view === "trash"
        ? t("emptyTrash")
        : mailboxFilter === "all"
          ? t("emptyAll")
          : t("emptyMailbox", { mailbox: mailboxFilter });

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
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              searchAll={searchAll}
              onSearchAllChange={setSearchAll}
            />
            <nav aria-label={t("views.label")}>
              <ul className="space-y-0.5">
                {THREAD_VIEWS.map((v) => {
                  const active = listMode === "threads" && view === v;
                  const badge = formatUnreadBadge(counts[v]);
                  return (
                    <li key={v}>
                      <button
                        type="button"
                        onClick={() => {
                          setListMode("threads");
                          setView(v);
                        }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center justify-between rounded px-2 py-1 text-[12px] transition-colors",
                          active
                            ? "bg-rojo/10 font-semibold text-rojo"
                            : badge
                              ? "font-semibold text-grafito hover:bg-gris-100 dark:text-gris-100 dark:hover:bg-gris-800"
                              : "text-gris-600 hover:bg-gris-100 dark:text-gris-300 dark:hover:bg-gris-800",
                        )}
                      >
                        <span>{viewLabels[v]}</span>
                        {badge ? (
                          <span
                            className="text-[11px] tabular-nums"
                            aria-label={t("unreadBadge", { count: counts[v] })}
                          >
                            {badge}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
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
                : searching
                  ? t("search.resultCount", { count: threads.length })
                  : t("threadCount", { count: threads.length })}
            </p>
            {listMode === "threads" && view === "trash" ? (
              <p className="text-[11px] text-gris-500 dark:text-gris-400">
                {t("trashNotice", { days: TRASH_RETENTION_DAYS })}
              </p>
            ) : null}
          </div>

          {listMode === "threads" && !loading && threads.length > 0 ? (
            <BulkToolbar
              view={view}
              allChecked={allChecked}
              someChecked={someChecked}
              selectedCount={checkedList.length}
              onToggleAll={() =>
                setCheckedIds(
                  allChecked ? new Set() : new Set(threads.map((th) => th.id)),
                )
              }
              onAction={(patch) => void applyState(checkedList, patch)}
            />
          ) : null}

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
              {emptyText}
            </p>
          ) : (
            <ThreadList
              threads={threads}
              selectedId={selectedId}
              onSelect={setSelectedId}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
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
              key={selectedThread.id}
              thread={selectedThread}
              onMarkRead={handleMarkRead}
              onLinkLead={handleLinkLead}
              onStateChange={(patch) => void applyState([selectedThread.id], patch)}
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
