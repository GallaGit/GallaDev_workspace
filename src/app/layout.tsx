import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full">
      <body
        className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}