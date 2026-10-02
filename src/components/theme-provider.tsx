"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useServerInsertedHTML } from "next/navigation";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** False until client has read stored/system theme — avoid icon hydration mismatch. */
  mounted: boolean;
};

const STORAGE_KEY = "lead-crm-theme";
const DEFAULT_THEME: Theme = "dark";

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => undefined,
  mounted: false,
});

const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(STORAGE_KEY)};var d=${JSON.stringify(DEFAULT_THEME)};var t=localStorage.getItem(k);if(t!=="dark"&&t!=="light")t=d;var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(t);e.style.colorScheme=t;}catch(e){}})();`;

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useServerInsertedHTML(() => (
    <script
      nonce={nonce}
      id="lead-crm-theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  ));

  useEffect(() => {
    let cancelled = false;
    let initial: Theme = DEFAULT_THEME;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") initial = stored;
    } catch {
      // ignore
    }
    applyThemeClass(initial);
    // Defer setState so the effect body stays free of synchronous updates
    // (react-hooks/set-state-in-effect); localStorage is the external system.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setThemeState(initial);
      setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    applyThemeClass(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, mounted }),
    [theme, setTheme, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
