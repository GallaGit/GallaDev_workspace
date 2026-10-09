"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_UNREAD_COUNTS,
  UNREAD_CHANGED_EVENT,
  type UnreadCounts,
} from "@/lib/email/thread-state";

const POLL_MS = 60_000;

/** Avisa a los contadores (barra lateral, pestañas) de que algo cambió. */
export function notifyUnreadChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT));
}

/**
 * Hilos no leídos por vista (Recibidos / Archivados / Papelera).
 * Solo pide datos si `enabled` (sesión Admin). Refresca con el evento
 * `correo:unread-changed`, al volver a la pestaña y cada minuto.
 */
export function useUnreadCounts(
  enabled: boolean,
  mailbox?: string | null,
): { counts: UnreadCounts; refresh: () => void } {
  const [counts, setCounts] = useState<UnreadCounts>(EMPTY_UNREAD_COUNTS);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const qs = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : "";
    fetch(`/api/email/threads/unread-count${qs}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as {
          counts?: Partial<UnreadCounts>;
        } | null;
        return data?.counts ?? null;
      })
      .then((next) => {
        if (cancelled || !next) return;
        setCounts({
          inbox: Number(next.inbox) || 0,
          archived: Number(next.archived) || 0,
          trash: Number(next.trash) || 0,
        });
      })
      .catch(() => {
        // Contador no crítico: se reintenta en el siguiente aviso o sondeo.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, mailbox, tick]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(UNREAD_CHANGED_EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => {
      window.removeEventListener(UNREAD_CHANGED_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  return { counts: enabled ? counts : EMPTY_UNREAD_COUNTS, refresh };
}
