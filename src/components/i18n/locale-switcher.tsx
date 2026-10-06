"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/set-locale";
import { locales, type AppLocale } from "@/i18n/config";
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

  function select(next: AppLocale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      data-testid="locale-switcher"
      className={cn(
        "inline-flex items-center rounded-md border border-border",
        size === "sm" ? "text-[11px]" : "text-sm",
        className,
      )}
    >
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          data-testid={`locale-${code}`}
          disabled={pending}
          aria-pressed={locale === code}
          onClick={() => select(code)}
          className={cn(
            "px-2 font-semibold uppercase transition-colors disabled:opacity-60",
            size === "sm" ? "py-0.5" : "py-1.5 px-3",
            locale === code
              ? "bg-muted text-fg"
              : "text-muted-fg hover:bg-muted/60 hover:text-fg",
          )}
        >
          {code === "es" ? t("es") : t("en")}
        </button>
      ))}
    </div>
  );
}
