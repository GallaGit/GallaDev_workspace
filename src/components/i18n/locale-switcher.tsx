"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/set-locale";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Compact for sidebar/topbar; full for login. */
  size?: "sm" | "md";
};

export function LocaleSwitcher({ className, size = "sm" }: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("locale");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nextLocale: AppLocale = locale === "es" ? "en" : "es";
  const switchLabel = t("switchTo");
  const activeCode = locale === "es" ? t("es") : t("en");

  function toggle() {
    if (pending) return;
    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div data-testid="locale-switcher" className={cn("inline-flex", className)}>
      <button
        type="button"
        data-testid="locale-trigger"
        data-locale={locale}
        aria-label={switchLabel}
        title={switchLabel}
        disabled={pending}
        onClick={toggle}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border bg-panel font-semibold uppercase text-fg transition-colors hover:bg-muted disabled:opacity-60",
          size === "sm" ? "h-7 min-w-9 px-2 text-[11px]" : "h-9 min-w-11 px-3 text-sm",
        )}
      >
        {activeCode}
      </button>
    </div>
  );
}
