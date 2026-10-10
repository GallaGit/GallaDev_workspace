"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { MAX_SEARCH_CHARS } from "@/lib/email/thread-search";

export const SEARCH_DEBOUNCE_MS = 300;

/** Valor retrasado: solo cambia tras `delay` ms sin cambios. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Caja de búsqueda de Correo: texto, botón de borrar y casilla
 * «buscar en todas las bandejas».
 */
export function SearchBox({
  value,
  onChange,
  searchAll,
  onSearchAllChange,
}: {
  value: string;
  onChange: (value: string) => void;
  searchAll: boolean;
  onSearchAllChange: (value: boolean) => void;
}) {
  const t = useTranslations("correo.search");
  return (
    <div role="search" className="space-y-1">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gris-400"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          maxLength={MAX_SEARCH_CHARS}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              onChange("");
            }
          }}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          className="w-full rounded border border-gris-200 bg-blanco py-1 pl-7 pr-7 text-[12px] text-grafito placeholder:text-gris-400 focus:border-rojo/40 focus:outline-none focus:ring-2 focus:ring-rojo/20 dark:border-gris-700 dark:bg-grafito dark:text-gris-100 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("clear")}
            title={t("clear")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gris-400 hover:text-grafito dark:hover:text-gris-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-gris-500 dark:text-gris-400">
        <input
          type="checkbox"
          className="h-3 w-3 accent-rojo"
          checked={searchAll}
          onChange={(e) => onSearchAllChange(e.target.checked)}
        />
        {t("allViews")}
      </label>
    </div>
  );
}
