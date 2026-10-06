import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AuthFlashBanner } from "@/components/auth-flash-banner";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { isDemoConfigured } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return {
    title: `${t("title")} · ${t("brand")}`,
    robots: "noindex, nofollow",
  };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const linkText = "galladev.com";
  const [subtitleBefore, ...subtitleAfter] = t("subtitle", {
    link: linkText,
  }).split(linkText);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-gris-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t("brand")}
            </p>
            <h1 className="mt-1 text-xl font-bold">{t("title")}</h1>
          </div>
          <LocaleSwitcher size="md" />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {subtitleBefore}
          <a className="underline" href="https://galladev.com">
            {linkText}
          </a>
          {subtitleAfter.join(linkText)}
        </p>
        <AuthFlashBanner kind="goodbye" />
        <Suspense>
          <LoginForm demoEnabled={isDemoConfigured()} />
        </Suspense>
      </div>
    </div>
  );
}
