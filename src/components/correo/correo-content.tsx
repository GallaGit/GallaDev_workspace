"use client";

import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposeDialog } from "@/components/correo/compose-dialog";
import { CORREO_SIDEBAR_ID } from "@/components/correo/correo-sidebar";
import { useCorreoWorkspaceOptional } from "@/components/correo/correo-workspace";
import { ThreadView } from "@/components/correo/thread-view";

/**
 * Área ancha del módulo: solo el hilo abierto, la redacción o un estado vacío.
 * La lista y las carpetas viven en la barra de correo (CorreoSidebar).
 */
export function CorreoContent() {
  const t = useTranslations("correo");
  const ws = useCorreoWorkspaceOptional();

  if (!ws) {
    return (
      <>
        <Topbar title={t("title")} subtitle={t("subtitle")} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <p className="text-sm text-gris-500 dark:text-gris-400">
            {t("noAccess")}
          </p>
        </div>
      </>
    );
  }

  const {
    composeOpen,
    selectedThread,
    selectedPending,
    drawerOpen,
    setDrawerOpen,
    folder,
  } = ws;

  return (
    <>
      <Topbar
        title={t("title")}
        subtitle={t("subtitle")}
        menu={{
          open: drawerOpen,
          onToggle: () => setDrawerOpen(!drawerOpen),
          controlsId: CORREO_SIDEBAR_ID,
          openLabel: t("openList"),
          closeLabel: t("closeList"),
        }}
      />
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-testid="correo-content"
      >
        {composeOpen ? (
          <ComposeDialog
            key={`compose-${ws.composeSession}`}
            variant="inline"
            open
            onOpenChange={ws.setComposeOpen}
            defaultMailboxAddress={ws.account}
            initialDraft={ws.editingDraft}
            onSent={ws.handleSent}
            onDraftSaved={ws.handleDraftSaved}
          />
        ) : selectedThread ? (
          <ThreadView
            key={selectedThread.id}
            thread={selectedThread}
            onMarkRead={ws.handleMarkRead}
            onLinkLead={ws.handleLinkLead}
            onStateChange={(patch) =>
              void ws.applyState([selectedThread.id], patch)
            }
          />
        ) : selectedPending ? (
          <div className="space-y-4 p-4">
            <Skeleton variant="card" lines={4} />
            <Skeleton variant="card" lines={4} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-gris-500 dark:text-gris-400">
              {folder === "drafts" ? t("openDraftHint") : t("selectThread")}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="md:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <Inbox className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("openList")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
