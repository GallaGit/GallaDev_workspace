"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setAuthFlash } from "@/components/auth-flash-banner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Pantalla para un usuario de Auth sin rol Admin, Seller ni Viewer.
 * No lista leads. El Admin asigna el rol en Settings → Equipo.
 */
export function PendingAccess() {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setAuthFlash("goodbye");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Igual salimos al login.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex h-full min-h-0 items-center justify-center overflow-auto bg-sidebar p-6 text-fg">
      <section className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-md">
        <h1 className="text-lg font-semibold">{t("auth.pending.title")}</h1>
        <p className="mt-2 text-sm text-muted-fg">
          {t("auth.pending.body")}
        </p>
        <Button type="button" className="mt-4" disabled={busy} onClick={() => void logout()}>
          {t("auth.pending.logout")}
        </Button>
      </section>
    </main>
  );
}
