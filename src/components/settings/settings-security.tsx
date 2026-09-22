"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setAuthFlash } from "@/components/auth-flash-banner";

export function SettingsSecurity() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleLogoutAll() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "global",
      });
      if (signOutError) {
        setError("No se pudo cerrar las sesiones");
        return;
      }
      setDone(true);
      setConfirming(false);
      setAuthFlash("goodbye");
      router.push("/login");
      router.refresh();
    } catch {
      setError("Error de red al cerrar las sesiones");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="seguridad-heading" className="rounded-lg border border-border bg-panel p-4">
      <h3 id="seguridad-heading" className="text-sm font-semibold text-fg">
        Seguridad
      </h3>
      <p className="mt-1 text-sm text-muted-fg">
        Botón de emergencia: cierra tu sesión en todos los dispositivos.
        Úsalo si sospechas que tus credenciales se han comprometido.
      </p>
      {done && (
        <p role="status" className="mt-2 text-sm text-muted-fg">
          Sesiones cerradas en todos los dispositivos. Vuelve a entrar.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {!confirming ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() => setConfirming(true)}
        >
          Cerrar todas las sesiones
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="w-full text-sm text-fg">
            ¿Seguro? Expulsará todos los dispositivos, incluido este.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={loading}
            onClick={handleLogoutAll}
          >
            Confirmar cierre global
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
        </div>
      )}
    </section>
  );
}
