import type { Metadata } from "next";
import { headers } from "next/headers";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GallaDev Workspace",
  description: "Herramienta interna GallaDev — revisión y cualificación de leads",
  robots: "noindex, nofollow",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Lee el nonce para forzar render dinámico. Next aplica ese valor a
  // los scripts del framework; el script de tema lo recibe aparte.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning className="h-full">
      <body
        className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <NextIntlClientProvider>
          <AppProviders nonce={nonce}>
            <AppShell>{children}</AppShell>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
