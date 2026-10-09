"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  Mail,
  MailOpen,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ThreadStatePatch } from "@/lib/email/email-payload";
import type { ThreadView as MailView } from "@/lib/email/thread-state";

/**
 * Barra de selección: casilla «todos» y acciones en bloque.
 * Las acciones dependen de la vista (archivar vs mover a Recibidos,
 * papelera vs restaurar).
 */
export function BulkToolbar({
  view,
  allChecked,
  someChecked,
  selectedCount,
  onToggleAll,
  onAction,
}: {
  view: MailView;
  allChecked: boolean;
  someChecked: boolean;
  selectedCount: number;
  onToggleAll: () => void;
  onAction: (patch: ThreadStatePatch) => void;
}) {
  const t = useTranslations("correo");
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someChecked;
  }, [someChecked]);

  return (
    <div
      role="toolbar"
      aria-label={t("bulkActionsLabel")}
      className="flex items-center gap-1 border-b border-gris-200 dark:border-gris-700 px-3 py-1.5"
    >
      <label className="flex cursor-pointer items-center pr-1">
        <input
          ref={checkboxRef}
          type="checkbox"
          className="h-3.5 w-3.5 accent-rojo"
          checked={allChecked}
          onChange={onToggleAll}
          aria-label={t("selectAll")}
        />
      </label>
      <span className="mr-auto text-[11px] text-gris-500 dark:text-gris-400">
        {selectedCount > 0 ? t("selectedCount", { count: selectedCount }) : null}
      </span>
      <StateActionButtons
        view={view}
        disabled={selectedCount === 0}
        onAction={onAction}
        showReadToggle
      />
    </div>
  );
}

type ActionButton = {
  key: string;
  label: string;
  icon: typeof Mail;
  patch: ThreadStatePatch;
};

/** Botones de icono compartidos por la barra en bloque y la vista del hilo. */
export function StateActionButtons({
  view,
  disabled = false,
  onAction,
  showReadToggle = false,
  isRead,
}: {
  view: MailView;
  disabled?: boolean;
  onAction: (patch: ThreadStatePatch) => void;
  /** En bloque se muestran ambos (leído y no leído). */
  showReadToggle?: boolean;
  /** En un hilo abierto: solo el contrario al estado actual. */
  isRead?: boolean;
}) {
  const t = useTranslations("correo");
  const btn =
    "rounded p-1.5 text-gris-500 transition-colors hover:bg-gris-100 hover:text-grafito disabled:pointer-events-none disabled:opacity-40 dark:text-gris-400 dark:hover:bg-gris-800 dark:hover:text-gris-100";

  const read: ActionButton = {
    key: "read",
    label: t("markRead"),
    icon: MailOpen,
    patch: { is_read: true },
  };
  const unread: ActionButton = {
    key: "unread",
    label: t("markUnread"),
    icon: Mail,
    patch: { is_read: false },
  };

  const buttons: ActionButton[] = [];
  if (showReadToggle) buttons.push(read, unread);
  else if (isRead !== undefined) buttons.push(isRead ? unread : read);

  if (view === "inbox") {
    buttons.push({ key: "archive", label: t("archive"), icon: Archive, patch: { archived: true } });
  } else if (view === "archived") {
    buttons.push({
      key: "inbox",
      label: t("moveToInbox"),
      icon: ArchiveRestore,
      patch: { archived: false },
    });
  }
  if (view === "trash") {
    buttons.push({ key: "restore", label: t("restore"), icon: RotateCcw, patch: { trashed: false } });
  } else {
    buttons.push({ key: "trash", label: t("moveToTrash"), icon: Trash2, patch: { trashed: true } });
  }

  return (
    <>
      {buttons.map(({ key, label, icon: Icon, patch }) => (
        <button
          key={key}
          type="button"
          className={btn}
          disabled={disabled}
          aria-label={label}
          title={label}
          onClick={() => onAction(patch)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </>
  );
}
