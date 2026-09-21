"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setAuthFlash } from "@/components/auth-flash-banner";

export function SettingsSecurity() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function handleLogoutAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout-all", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; epoch?: number; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo cerrar las sesiones");
        return;
      }
      setDone(typeof data.epoch === "number" ? data.epoch : null);
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
        Botón de emergencia: cierra todas las sesiones en todos los
        dispositivos. Úsalo si sospechas que la contraseña se ha comprometido.
      </p>
      {done !== null && (
        <p role="status" className="mt-2 text-sm text-muted-fg">
          Sesiones invalidadas (epoch {done}). Vuelve a entrar.
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
