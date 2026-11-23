"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, PenSquare, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_MENU_BUTTON_ID } from "@/components/layout/nav-chrome";
import { BulkToolbar } from "@/components/correo/thread-actions";
import { SearchBox } from "@/components/correo/search-box";
import { ThreadList } from "@/components/correo/thread-list";
import { useCorreoWorkspace } from "@/components/correo/correo-workspace";
import { cn } from "@/lib/utils";
import {
  CORREO_FOLDERS,
  accountLabel,
  correoPath,
  folderThreadView,
  type AccountFilter,
  type CorreoFolder,
} from "@/lib/email/correo-routes";
import { COMPANY_MAILBOXES, mailboxChipLabel } from "@/lib/email/mailboxes";
import { TRASH_RETENTION_DAYS, formatUnreadBadge } from "@/lib/email/thread-state";

export const CORREO_SIDEBAR_ID = "correo-sidebar";

function formatDraftDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

/** Clic normal: navegación dentro del módulo; con modificadores, el enlace del navegador. */
function isPlainClick(e: React.MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}

/**
 * Barra lateral dedicada al correo. Sustituye a la barra general de la app
 * mientras se está en /correo. En escritorio es una columna fija; por debajo
 * de `md` es un cajón (se abre con el botón de menú de la cabecera y se cierra
 * al elegir un hilo, con la X o tocando el fondo): nunca tapa el contenido de
 * forma permanente.
 */
export function CorreoSidebar() {
  const t = useTranslations("correo");
  const locale = useLocale();
  const ws = useCorreoWorkspace();
  const {
    folder,
    account,
    threads,
    drafts,
    loading,
    loadingMore,
    hasMore,
    counts,
    selectedId,
    composeOpen,
    editingDraft,
    searching,
    searchQuery,
    searchAll,
    drawerOpen,
    setDrawerOpen,
  } = ws;
  const view = folderThreadView(folder);
  const isDrafts = folder === "drafts";

  const asideRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMobile(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Al pasar a escritorio el cajón deja de tener sentido.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile, setDrawerOpen]);

  const drawerActive = isMobile && drawerOpen;

  // Escape cierra, el foco se queda en el cajón y el fondo no se desplaza.
  useEffect(() => {
    if (!drawerActive) return;
    const panel = asideRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.getElementById(NAV_MENU_BUTTON_ID)?.focus();
    };
  }, [drawerActive, setDrawerOpen]);

  const viewLabels: Record<string, string> = {
    inbox: t("views.inbox"),
    sent: t("views.sent"),
    archived: t("views.archived"),
    trash: t("views.trash"),
    drafts: t("drafts"),
  };

  const accountOptions: { id: AccountFilter; label: string }[] = [
    { id: "all", label: t("all") },
    ...COMPANY_MAILBOXES.map((m) => ({ id: m as AccountFilter, label: accountLabel(m) })),
  ];

  const allChecked = threads.length > 0 && ws.checkedList.length === threads.length;
  const someChecked = ws.checkedList.length > 0 && !allChecked;

  const emptyText = searching
    ? t("search.noResults", { query: searchQuery })
    : folder === "archived"
      ? t("emptyArchived")
      : folder === "trash"
        ? t("emptyTrash")
        : folder === "sent"
          ? t("emptySent")
          : account === "all"
            ? t("emptyAll")
            : t("emptyMailbox", { mailbox: account });

  return (
    <>
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
          data-testid="correo-drawer-overlay"
        />
      ) : null}
      <aside
        ref={asideRef}
        id={CORREO_SIDEBAR_ID}
        data-correo-sidebar
        role={drawerActive ? "dialog" : undefined}
        aria-modal={drawerActive ? true : undefined}
        aria-label={t("sidebarAria")}
        aria-hidden={isMobile && !drawerOpen ? true : undefined}
        inert={isMobile && !drawerOpen ? true : undefined}
        className={cn(
          "flex h-full min-h-0 w-[85vw] max-w-80 flex-col bg-sidebar",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-150",
          "md:static md:z-auto md:w-80 md:max-w-none md:shrink-0 md:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="shrink-0 space-y-2 px-3 pb-2 pt-2.5">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-1 gap-1.5 px-2"
              onClick={ws.goBack}
              data-testid="correo-back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto md:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("closeList")}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={ws.openNewCompose}
          >
            <PenSquare className="mr-1.5 h-3.5 w-3.5" />
            {t("new")}
          </Button>
          <SearchBox
            value={ws.searchInput}
            onChange={ws.setSearchInput}
            searchAll={searchAll}
            onSearchAllChange={ws.setSearchAll}
          />
          <nav aria-label={t("views.label")}>
            <ul className="space-y-0.5">
              {CORREO_FOLDERS.map((f: CorreoFolder) => {
                const countView = folderThreadView(f);
                const unread = countView ? counts[countView] : 0;
                const badge = formatUnreadBadge(unread);
                const active = folder === f;
                return (
                  <li key={f}>
                    <a
                      href={correoPath(f, null, account)}
                      onClick={(e) => {
                        if (!isPlainClick(e)) return;
                        e.preventDefault();
                        ws.openFolder(f);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center justify-between rounded px-2 py-1 text-[12px] transition-colors",
                        active
                          ? "bg-rojo/10 font-semibold text-rojo"
                          : badge
                            ? "font-semibold text-fg hover:bg-muted"
                            : "text-muted-fg hover:bg-muted hover:text-fg",
                      )}
                    >
                      <span>{viewLabels[f]}</span>
                      {badge ? (
                        <span
                          className="text-[11px] tabular-nums"
                          aria-label={t("unreadBadge", { count: unread })}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <section aria-label={t("accounts")}>
            <h2 className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-fg">
              {t("accounts")}
            </h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {accountOptions.map((opt) => {
                const active = account === opt.id;
                return (
                  <a
                    key={opt.id}
                    href={correoPath(folder, selectedId, opt.id)}
                    onClick={(e) => {
                      if (!isPlainClick(e)) return;
                      e.preventDefault();
                      ws.selectAccount(opt.id);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] transition-colors",
                      active
                        ? "bg-rojo/10 font-semibold text-rojo"
                        : "text-muted-fg hover:bg-muted hover:text-fg",
                    )}
                  >
                    {opt.label}
                  </a>
                );
              })}
            </div>
          </section>
          <p className="px-2 text-[11px] text-muted-fg">
            {isDrafts
              ? t("draftCount", { count: drafts.length })
              : searching
                ? t("search.resultCount", { count: threads.length })
                : t("threadCount", { count: threads.length })}
          </p>
          {view === "trash" ? (
            <p className="px-2 text-[11px] text-muted-fg">
              {t("trashNotice", { days: TRASH_RETENTION_DAYS })}
            </p>
          ) : null}
        </div>

        <div
          className="mx-2 mb-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-blanco dark:bg-grafito"
          data-testid="correo-list-panel"
        >
          {!isDrafts && view && !loading && threads.length > 0 ? (
            <BulkToolbar
              view={view}
              allChecked={allChecked}
              someChecked={someChecked}
              selectedCount={ws.checkedList.length}
              onToggleAll={() => ws.setAllChecked(!allChecked)}
              onAction={(patch) => void ws.applyState(ws.checkedList, patch)}
            />
          ) : null}

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="space-y-3 p-3">
                <Skeleton variant="card" lines={3} />
                <Skeleton variant="card" lines={3} />
                <Skeleton variant="card" lines={3} />
              </div>
            ) : isDrafts ? (
              drafts.length === 0 ? (
                <p className="p-4 text-[13px] text-gris-500 dark:text-gris-400">
                  {t("emptyDrafts")}
                </p>
              ) : (
                <ul role="listbox" aria-label={t("drafts")}>
                  {drafts.map((draft) => {
                    const active = composeOpen && editingDraft?.id === draft.id;
                    return (
                      <li key={draft.id} role="option" aria-selected={active}>
                        <div
                          className={cn(
                            "flex items-start gap-1 border-b border-gris-200 dark:border-gris-700",
                            active && "bg-rojo/5 dark:bg-rojo/10",
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-gris-50 dark:hover:bg-gris-800"
                            onClick={() => ws.openDraft(draft)}
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
                            onClick={() => void ws.handleDeleteDraft(draft.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
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
                onSelect={ws.openThread}
                checkedIds={ws.checkedIds}
                onToggleChecked={ws.toggleChecked}
              />
            )}

            {!isDrafts && !loading && hasMore ? (
              <div className="p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  loading={loadingMore}
                  onClick={() => void ws.loadMore()}
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
