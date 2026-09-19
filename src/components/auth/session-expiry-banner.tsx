"use client";

import { useCallback, useEffect, useState } from "react";

type SessionInfo = {
  authenticated?: boolean;
  authDisabled?: boolean;
  needsWarning?: boolean;
  remainingMs?: number;
};

function formatRemaining(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function SessionExpiryBanner() {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SessionInfo;
      setInfo(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!info?.authenticated || info.authDisabled || !info.needsWarning) {
    return null;
  }

  const remaining =
    typeof info.remainingMs === "number"
      ? formatRemaining(info.remainingMs)
      : "poco";

  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-500/15 px-3 py-2 text-center text-[12px] text-amber-100"
    >
      Tu sesión caduca en {remaining}. Guarda el trabajo o vuelve a iniciar
      sesión pronto.
    </div>
  );
}
