"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DIGEST_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Fallback compartido por `app/error.tsx` y `app/global-error.tsx`.
 * No muestra `error.message`: en cliente puede incluir detalle interno.
 */
export function AppErrorFallback({
  digest,
  onRetry,
}: {
  digest?: string;
  onRetry: () => void;
}) {
  const ref = digest && DIGEST_RE.test(digest) ? digest : undefined;
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div
        role="alert"
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-gris-800"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          GallaDev Workspace
        </p>
        <h1 className="mt-1 text-xl font-bold">Algo ha fallado</h1>
        <p className="mt-1 text-sm text-gray-500">
          No hemos podido mostrar esta pantalla. Puedes reintentar o volver al
          inicio.
        </p>
        {ref ? (
          <p className="mt-3 font-mono text-xs text-gray-400">Ref. {ref}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={onRetry}>
            Reintentar
          </Button>
          {/* Carga completa: el router puede ser lo que ha fallado. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium",
              "bg-gris-100 text-grafito hover:bg-gris-200",
              "dark:bg-gris-800 dark:text-gris-100 dark:hover:bg-gris-700",
            )}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
