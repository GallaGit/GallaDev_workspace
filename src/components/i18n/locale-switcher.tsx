"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/set-locale";
import { locales, type AppLocale } from "@/i18n/config";
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const flagClass = size === "sm" ? "h-3.5 w-5" : "h-4 w-6";

  function select(next: AppLocale) {
    setOpen(false);
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-testid="locale-switcher"
      className={cn("relative inline-flex", className)}
    >
      <button
        type="button"
        data-testid="locale-trigger"
        aria-label={t("label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border bg-panel text-fg transition-colors hover:bg-muted disabled:opacity-60",
          size === "sm" ? "h-7 w-9" : "h-9 w-11",
        )}
      >
        <LocaleFlag locale={locale} className={cn(flagClass, "rounded-sm")} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("label")}
          className="absolute right-0 top-full z-50 mt-1 min-w-[5.5rem] overflow-hidden rounded-md border border-border bg-panel py-1 shadow-md"
        >
          {locales.map((code) => {
            const selected = locale === code;
            const label = code === "es" ? t("es") : t("en");
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  data-testid={`locale-${code}`}
                  aria-selected={selected}
                  disabled={pending}
                  onClick={() => select(code)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] font-semibold uppercase transition-colors disabled:opacity-60",
                    selected
                      ? "bg-muted text-fg"
                      : "text-muted-fg hover:bg-muted/60 hover:text-fg",
                  )}
                >
                  <LocaleFlag
                    locale={code}
                    className="h-3.5 w-5 shrink-0 rounded-sm"
                  />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
