"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

export type AuthFlashKind = "welcome" | "goodbye";

const STORAGE_KEY = "galladev-auth-flash";
const MESSAGE_KEYS = {
  welcome: [
    "auth.flash.welcome0",
    "auth.flash.welcome1",
    "auth.flash.welcome2",
  ],
  goodbye: [
    "auth.flash.goodbye0",
    "auth.flash.goodbye1",
    "auth.flash.goodbye2",
  ],
} as const;

export function setAuthFlash(kind: AuthFlashKind): void {
  window.sessionStorage.setItem(STORAGE_KEY, kind);
}

export function AuthFlashBanner({ kind }: { kind: AuthFlashKind }) {
  const t = useTranslations();
  const [messageKey, setMessageKey] = useState<
    (typeof MESSAGE_KEYS)[AuthFlashKind][number] | null
  >(null);

  useEffect(() => {
    const pending = window.sessionStorage.getItem(STORAGE_KEY);
    if (pending !== kind) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const messageKeys = MESSAGE_KEYS[kind];
    const showTimeout = window.setTimeout(() => {
      setMessageKey(
        messageKeys[Math.floor(Math.random() * messageKeys.length)] ??
          messageKeys[0],
      );
    }, 0);
    const hideTimeout = window.setTimeout(() => setMessageKey(null), 6000);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [kind]);

  if (!messageKey) return null;

  return (
    <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-rojo/25 bg-rojo/10 px-3 py-2 text-sm text-grafito dark:text-gris-100">
      <span>{t(messageKey)}</span>
      <button type="button" onClick={() => setMessageKey(null)} className="rounded p-1 text-gris-500 hover:bg-black/5 hover:text-grafito dark:hover:bg-white/10 dark:hover:text-white" aria-label={t("auth.flash.close")}>
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
