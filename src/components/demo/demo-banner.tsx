"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionAccess } from "@/components/session-access";

export function DemoBanner() {
  const { isVisitor, ready } = useSessionAccess();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  if (!ready || !isVisitor) return null;

  async function exitDemo() {
    setLeaving(true);
    try {
      await fetch("/api/demo/exit", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div
      data-testid="demo-banner"
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <p>Estás viendo una demo con datos ficticios</p>
      <button
        type="button"
        data-testid="demo-exit"
        onClick={() => void exitDemo()}
        disabled={leaving}
        className="rounded-md border border-amber-800 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-200 dark:text-amber-50 dark:hover:bg-amber-900"
      >
        {leaving ? "Saliendo…" : "Salir de la demo"}
      </button>
    </div>
  );
}
