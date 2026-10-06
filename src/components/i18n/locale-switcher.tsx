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

function SpainFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 21 15"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="21" height="15" fill="#AA151B" />
      <rect y="3.75" width="21" height="7.5" fill="#F1BF00" />
    </svg>
  );
}

function UsFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 21 15"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="21" height="15" fill="#B22234" />
      <rect y="1.15" width="21" height="1.15" fill="#fff" />
      <rect y="3.46" width="21" height="1.15" fill="#fff" />
      <rect y="5.77" width="21" height="1.15" fill="#fff" />
      <rect y="8.08" width="21" height="1.15" fill="#fff" />
      <rect y="10.38" width="21" height="1.15" fill="#fff" />
      <rect y="12.69" width="21" height="1.15" fill="#fff" />
      <rect width="8.4" height="8.08" fill="#3C3B6E" />
    </svg>
  );
}

function LocaleFlag({
  locale,
  className,
}: {
  locale: AppLocale;
  className?: string;
}) {
  return locale === "es" ? (
    <SpainFlag className={className} />
  ) : (
    <UsFlag className={className} />
  );
}

export function LocaleSwitcher({ className, size = "sm" }: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("locale");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nextLocale: AppLocale = locale === "es" ? "en" : "es";
  const switchLabel = t("switchTo");
  const flagClass = size === "sm" ? "h-3.5 w-5" : "h-4 w-6";

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
          "inline-flex items-center justify-center rounded-md border border-border bg-panel text-fg transition-colors hover:bg-muted disabled:opacity-60",
          size === "sm" ? "h-7 w-9" : "h-9 w-11",
        )}
      >
        <LocaleFlag locale={locale} className={cn(flagClass, "rounded-sm")} />
      </button>
    </div>
  );
}
