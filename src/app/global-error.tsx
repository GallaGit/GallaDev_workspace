"use client";

import { NextIntlClientProvider } from "next-intl";
import { AppErrorFallback } from "@/components/app-error-fallback";
import { defaultLocale } from "@/i18n/config";
import messages from "../../messages/es.json";
import "./globals.css";

/**
 * Sustituye el root layout cuando el fallo está en el propio layout.
 * Next 16 exige `<html>` y `<body>` aquí; los estilos globales no se heredan.
 * Incluye NextIntlClientProvider porque este árbol no hereda el root layout.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang={defaultLocale}>
      <body className="min-h-full antialiased">
        <NextIntlClientProvider locale={defaultLocale} messages={messages}>
          <AppErrorFallback digest={error.digest} onRetry={retry} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
