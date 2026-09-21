"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type AuthFlashKind = "welcome" | "goodbye";

const STORAGE_KEY = "galladev-auth-flash";
const MESSAGES: Record<AuthFlashKind, readonly string[]> = {
  welcome: [
    "Bienvenido de nuevo. Todo listo para continuar.",
    "Sesión iniciada. Vamos a por ello.",
    "Qué bueno verte otra vez. Tu workspace está preparado.",
  ],
  goodbye: [
    "Sesión cerrada correctamente. Hasta pronto.",
    "Gracias por el trabajo de hoy. Nos vemos.",
    "Has salido del workspace de forma segura.",
  ],
};

export function setAuthFlash(kind: AuthFlashKind): void {
  window.sessionStorage.setItem(STORAGE_KEY, kind);
}

export function AuthFlashBanner({ kind }: { kind: AuthFlashKind }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const pending = window.sessionStorage.getItem(STORAGE_KEY);
    if (pending !== kind) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const messages = MESSAGES[kind];
    const showTimeout = window.setTimeout(() => {
      setMessage(messages[Math.floor(Math.random() * messages.length)] ?? messages[0]);
    }, 0);
    const hideTimeout = window.setTimeout(() => setMessage(null), 6000);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [kind]);

  if (!message) return null;

  return (
    <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-rojo/25 bg-rojo/10 px-3 py-2 text-sm text-grafito dark:text-gris-100">
      <span>{message}</span>
      <button type="button" onClick={() => setMessage(null)} className="rounded p-1 text-gris-500 hover:bg-black/5 hover:text-grafito dark:hover:bg-white/10 dark:hover:text-white" aria-label="Cerrar mensaje">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
