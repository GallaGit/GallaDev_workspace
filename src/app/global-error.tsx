"use client";

import { AppErrorFallback } from "@/components/app-error-fallback";
import "./globals.css";

/**
 * Sustituye el root layout cuando el fallo está en el propio layout.
 * Next 16 exige `<html>` y `<body>` aquí; los estilos globales no se heredan.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-full antialiased">
        <AppErrorFallback digest={error.digest} onRetry={retry} />
      </body>
    </html>
  );
}
