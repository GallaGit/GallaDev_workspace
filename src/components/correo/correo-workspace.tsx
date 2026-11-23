"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { EmailDraft } from "@/components/correo/compose-dialog";
import type { EmailThread } from "@/components/correo/types";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "@/components/correo/search-box";
import {
  notifyUnreadChanged,
  useUnreadCounts,
} from "@/components/correo/use-unread-counts";
import {
  correoPath,
  folderThreadView,
  parseAccountParam,
  parseCorreoPath,
  type AccountFilter,
  type CorreoFolder,
} from "@/lib/email/correo-routes";
import type { ThreadStatePatch } from "@/lib/email/email-payload";
import { readJsonResponse } from "@/lib/http/read-json";
import {
  applyThreadPatch,
  stateToastKey,
  threadStaysInView,
  threadViewOf,
  type ThreadView as MailView,
  type UnreadCounts,
} from "@/lib/email/thread-state";
import { mergeThreadPage } from "@/lib/email/thread-list-merge";

/** Tamaño de página del API (default del servidor); una página llena => hay más. */
export const THREAD_PAGE_SIZE = 50;

function threadListParams(
  view: MailView,
  searchQuery: string,
  searchAll: boolean,
  account: AccountFilter,
  offset?: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("view", view);
  if (searchQuery) {
    params.set("q", searchQuery);
    if (searchAll) params.set("scope", "all");
  }
  if (account !== "all") {
    params.set("mailbox", account);
  }
  if (offset !== undefined) params.set("offset", String(offset));
  return params;
}

/**
 * Cambia la URL sin pasar por el servidor: Next integra pushState/replaceState
 * en el router (usePathname y useSearchParams se actualizan).
 */
function navigateInModule(url: string, replace = false): void {
  if (typeof window === "undefined") return;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

export type CorreoWorkspaceValue = {
  folder: CorreoFolder;
  account: AccountFilter;
  selectedId: string | null;
  selectedThread: EmailThread | null;
  /** Hay un hilo en la URL que aún se está cargando. */
  selectedPending: boolean;

  threads: EmailThread[];
  drafts: EmailDraft[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  counts: UnreadCounts;

  searchInput: string;
  setSearchInput: (value: string) => void;
  searchAll: boolean;
  setSearchAll: (value: boolean) => void;
  searchQuery: string;
  searching: boolean;

  checkedIds: ReadonlySet<string>;
  checkedList: string[];
  toggleChecked: (id: string) => void;
  setAllChecked: (checked: boolean) => void;

  openFolder: (folder: CorreoFolder) => void;
  selectAccount: (account: AccountFilter) => void;
  openThread: (id: string) => void;
  loadMore: () => Promise<void>;
  applyState: (ids: string[], patch: ThreadStatePatch) => Promise<void>;
  handleMarkRead: (threadId: string) => void;
  handleLinkLead: (threadId: string, leadId: string | null) => void;

  composeOpen: boolean;
  composeSession: number;
  editingDraft: EmailDraft | null;
  openNewCompose: () => void;
  openDraft: (draft: EmailDraft) => void;
  setComposeOpen: (open: boolean) => void;
  handleSent: (threadId: string, draftId?: string) => void;
  handleDraftSaved: (draft: EmailDraft, meta?: { auto: boolean }) => void;
  handleDeleteDraft: (draftId: string) => Promise<void>;

  /** Cajón de la barra de correo en móvil. */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Vuelve a la página desde la que se entró (o al dashboard). */
  goBack: () => void;
};

const WorkspaceContext = createContext<CorreoWorkspaceValue | null>(null);

export function useCorreoWorkspace(): CorreoWorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useCorreoWorkspace must be used within CorreoWorkspaceProvider");
  }
  return ctx;
}

/** Para piezas que también pueden pintarse fuera del módulo (tests). */
export function useCorreoWorkspaceOptional(): CorreoWorkspaceValue | null {
  return useContext(WorkspaceContext);
}

export function CorreoWorkspaceProvider({
  children,
  enabled = true,
  backHref = "/",
}: {
  children: React.ReactNode;
  /** false => no pide datos (sesión sin acceso al buzón). */
  enabled?: boolean;
  backHref?: string;
}) {
  const t = useTranslations("correo");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { folder, threadId: selectedId } = parseCorreoPath(pathname);
  const account = parseAccountParam(searchParams.get("cuenta"));
  const view = folderThreadView(folder);
  const isDrafts = folder === "drafts";

  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fetched, setFetched] = useState<EmailThread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<EmailDraft | null>(null);
  const [composeSession, setComposeSession] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchQuery = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const searching = searchQuery.length > 0;
  const crossFolderSearch = searching && searchAll;

  const threadsRef = useRef<EmailThread[]>([]);
  const loadingMoreRef = useRef(false);
  const listGenRef = useRef(0);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  const { counts, version: refreshVersion } = useUnreadCounts(
    enabled,
    account === "all" ? null : account,
  );

  // Abrir un hilo (o volver atrás hasta uno) deja la redacción.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    if (selectedId) setComposeOpen(false);
  }

  useEffect(() => {
    if (!enabled || !view) return;
    let cancelled = false;
    async function load() {
      const gen = ++listGenRef.current;
      setLoading(true);
      setHasMore(false);
      try {
        const params = threadListParams(view!, searchQuery, searchAll, account);
        const res = await fetch(`/api/email/threads?${params.toString()}`);
        const data = await readJsonResponse<{ threads?: EmailThread[] }>(
          res,
          t("loadThreadsError"),
        );
        if (cancelled || gen !== listGenRef.current) return;
        const page = data.threads ?? [];
        setThreads(page);
        setHasMore(page.length === THREAD_PAGE_SIZE);
        setCheckedIds(new Set());
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : t("loadMailboxError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, view, account, reloadKey, searchQuery, searchAll, t]);

  // Refresco silencioso al ritmo de los contadores (60 s, pestaña visible,
  // evento correo:unread-changed): no toca la selección, el scroll ni el hilo.
  const refreshVersionRef = useRef(refreshVersion);
  useEffect(() => {
    if (refreshVersionRef.current === refreshVersion) return;
    refreshVersionRef.current = refreshVersion;
    if (!enabled || !view || loadingMoreRef.current) return;
    const gen = listGenRef.current;
    let cancelled = false;
    async function refresh() {
      try {
        const params = threadListParams(view!, searchQuery, searchAll, account);
        const res = await fetch(`/api/email/threads?${params.toString()}`);
        const data = await readJsonResponse<{ threads?: EmailThread[] }>(
          res,
          t("loadThreadsError"),
        );
        if (cancelled || gen !== listGenRef.current || loadingMoreRef.current) {
          return;
        }
        const page = data.threads ?? [];
        const previousLength = threadsRef.current.length;
        setThreads((prev) => mergeThreadPage(prev, page, THREAD_PAGE_SIZE));
        if (page.length < THREAD_PAGE_SIZE) setHasMore(false);
        else if (previousLength <= THREAD_PAGE_SIZE) setHasMore(true);
      } catch {
        // Refresco de fondo: un fallo de red no molesta; se reintenta en 60 s.
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [refreshVersion, enabled, view, searchQuery, searchAll, account, t]);

  const inList = selectedId
    ? (threads.find((thread) => thread.id === selectedId) ?? null)
    : null;
  const fetchedForSelection =
    selectedId && fetched?.id === selectedId ? fetched : null;
  const selectedThread = inList ?? fetchedForSelection;

  // Hilo en la URL que la página cargada no trae (enlace compartido, ficha del
  // lead, otra página de la lista): se pide aparte y, si pertenece a otra
  // carpeta, la URL se corrige a la suya.
  const hasInList = inList !== null;
  const fetchedId = fetched?.id ?? null;
  useEffect(() => {
    if (!enabled || !selectedId || loading || hasInList) return;
    if (fetchedId === selectedId) return;
    let cancelled = false;
    async function openLinkedThread() {
      try {
        const res = await fetch(`/api/email/threads/${selectedId}`);
        const data = await readJsonResponse<{ thread?: EmailThread }>(
          res,
          t("loadThreadError"),
        );
        if (cancelled) return;
        const thread = data.thread;
        if (!thread) throw new Error(t("loadThreadError"));
        setFetched(thread);
        if (view && !crossFolderSearch && !threadStaysInView(thread, view)) {
          navigateInModule(correoPath(threadViewOf(thread), thread.id, account), true);
        }
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : t("loadThreadError"));
        navigateInModule(correoPath(folder, null, account), true);
      }
    }
    void openLinkedThread();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    selectedId,
    loading,
    hasInList,
    fetchedId,
    view,
    folder,
    account,
    crossFolderSearch,
    t,
  ]);

  const selectedPending = Boolean(selectedId) && !selectedThread;

  const loadMore = useCallback(async () => {
    if (!view || loadingMoreRef.current || !hasMore) return;
    const gen = listGenRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const params = threadListParams(
        view,
        searchQuery,
        searchAll,
        account,
        threadsRef.current.length,
      );
      const res = await fetch(`/api/email/threads?${params.toString()}`);
      const data = await readJsonResponse<{ threads?: EmailThread[] }>(
        res,
        t("loadThreadsError"),
      );
      if (gen !== listGenRef.current) return;
      const page = data.threads ?? [];
      setThreads((prev) => {
        const seen = new Set(prev.map((thread) => thread.id));
        return [...prev, ...page.filter((thread) => !seen.has(thread.id))];
      });
      setHasMore(page.length === THREAD_PAGE_SIZE);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadThreadsError"));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [view, hasMore, searchQuery, searchAll, account, t]);

  useEffect(() => {
    if (!enabled || !isDrafts) return;
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
        setDrafts(data.drafts ?? []);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : t("loadDraftsError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, isDrafts, composeOpen, t]);

  const visibleDrafts = useMemo(
    () =>
      account === "all"
        ? drafts
        : drafts.filter((draft) => draft.mailbox_address === account),
    [drafts, account],
  );

  const openFolder = useCallback(
    (next: CorreoFolder) => {
      navigateInModule(correoPath(next, null, account));
    },
    [account],
  );

  const selectAccount = useCallback(
    (next: AccountFilter) => {
      navigateInModule(correoPath(folder, selectedId, next));
    },
    [folder, selectedId],
  );

  const openThread = useCallback(
    (id: string) => {
      setComposeOpen(false);
      setDrawerOpen(false);
      navigateInModule(correoPath(folder, id, account));
    },
    [folder, account],
  );

  const closeThread = useCallback(() => {
    navigateInModule(correoPath(folder, null, account), true);
  }, [folder, account]);

  const handleMarkRead = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, is_read: true } : thread,
      ),
    );
    setFetched((prev) =>
      prev && prev.id === threadId ? { ...prev, is_read: true } : prev,
    );
    notifyUnreadChanged();
  }, []);

  /**
   * Leído/no leído, archivar, papelera y restaurar sobre uno o varios hilos.
   * Optimista: actualiza la lista y la deshace si la API falla.
   */
  const applyState = useCallback(
    async (ids: string[], patch: ThreadStatePatch) => {
      if (ids.length === 0 || !view) return;
      const previous = threadsRef.current;
      const previousFetched = fetched;
      const idSet = new Set(ids);
      const now = new Date();
      const next = previous
        .map((thread) =>
          idSet.has(thread.id) ? applyThreadPatch(thread, patch, now) : thread,
        )
        // En «buscar en todas las bandejas» las filas se quedan aunque cambien de vista.
        .filter((thread) => crossFolderSearch || threadStaysInView(thread, view));
      const stillVisible = new Set(next.map((thread) => thread.id));
      threadsRef.current = next;
      setThreads(next);
      if (previousFetched && idSet.has(previousFetched.id)) {
        const patched = applyThreadPatch(previousFetched, patch, now);
        setFetched(patched);
        if (crossFolderSearch || threadStaysInView(patched, view)) {
          stillVisible.add(patched.id);
        }
      }
      setCheckedIds((prev) => {
        const kept = new Set<string>();
        prev.forEach((id) => {
          if (stillVisible.has(id)) kept.add(id);
        });
        return kept;
      });
      // Como Gmail: marcar no leído o sacar el hilo de la vista lo cierra.
      if (
        selectedId &&
        idSet.has(selectedId) &&
        (!stillVisible.has(selectedId) || patch.is_read === false)
      ) {
        closeThread();
      }

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
        setFetched(previousFetched);
        toast.error(e instanceof Error ? e.message : t("actionError"));
      } finally {
        notifyUnreadChanged();
      }
    },
    [view, crossFolderSearch, fetched, selectedId, closeThread, t],
  );

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllChecked = useCallback((checked: boolean) => {
    setCheckedIds(
      checked ? new Set(threadsRef.current.map((th) => th.id)) : new Set(),
    );
  }, []);

  const handleLinkLead = useCallback(
    (threadId: string, leadId: string | null) => {
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId ? { ...thread, lead_id: leadId } : thread,
        ),
      );
      setFetched((prev) =>
        prev && prev.id === threadId ? { ...prev, lead_id: leadId } : prev,
      );
    },
    [],
  );

  const openNewCompose = useCallback(() => {
    setEditingDraft(null);
    setComposeSession((n) => n + 1);
    setComposeOpen(true);
    setDrawerOpen(false);
    if (selectedId) closeThread();
  }, [selectedId, closeThread]);

  const openDraft = useCallback((draft: EmailDraft) => {
    setEditingDraft(draft);
    setComposeSession((n) => n + 1);
    setComposeOpen(true);
    setDrawerOpen(false);
  }, []);

  // El panel se remonta solo al abrir (composeSession); guardar no lo reinicia.
  const handleDraftSaved = useCallback(
    (draft: EmailDraft, meta?: { auto: boolean }) => {
      setEditingDraft(draft);
      setDrafts((prev) => {
        const without = prev.filter((d) => d.id !== draft.id);
        return [draft, ...without];
      });
      if (!meta?.auto) navigateInModule(correoPath("drafts", null, account));
    },
    [account],
  );

  const handleSent = useCallback(
    (threadId: string, draftId?: string) => {
      if (draftId) setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setEditingDraft(null);
      setComposeOpen(false);
      setReloadKey((k) => k + 1);
      navigateInModule(correoPath("sent", threadId, account));
    },
    [account],
  );

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

  const goBack = useCallback(() => {
    router.push(backHref);
  }, [router, backHref]);

  const checkedList = useMemo(
    () => threads.filter((th) => checkedIds.has(th.id)).map((th) => th.id),
    [threads, checkedIds],
  );

  const value: CorreoWorkspaceValue = {
    folder,
    account,
    selectedId,
    selectedThread,
    selectedPending,
    threads,
    drafts: visibleDrafts,
    loading,
    loadingMore,
    hasMore,
    counts,
    searchInput,
    setSearchInput,
    searchAll,
    setSearchAll,
    searchQuery,
    searching,
    checkedIds,
    checkedList,
    toggleChecked,
    setAllChecked,
    openFolder,
    selectAccount,
    openThread,
    loadMore,
    applyState,
    handleMarkRead,
    handleLinkLead,
    composeOpen,
    composeSession,
    editingDraft,
    openNewCompose,
    openDraft,
    setComposeOpen,
    handleSent,
    handleDraftSaved,
    handleDeleteDraft,
    drawerOpen,
    setDrawerOpen,
    goBack,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
