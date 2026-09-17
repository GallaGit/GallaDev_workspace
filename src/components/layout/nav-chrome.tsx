"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

export const NAV_MENU_BUTTON_ID = "app-nav-menu-button";

type NavChromeContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  navId: string;
};

const NavChromeContext = createContext<NavChromeContextValue | null>(null);

export function NavChromeProvider({ children }: { children: React.ReactNode }) {
  const [openIntent, setOpenIntent] = useState(false);
  const [openedForPath, setOpenedForPath] = useState<string | null>(null);
  const navId = useId();
  const pathname = usePathname();
  const wasOpenRef = useRef(false);

  // Derive open from intent + path so a route change closes the drawer
  // without calling setState inside an effect.
  const open = openIntent && openedForPath === pathname;

  const setOpen = useCallback(
    (next: boolean) => {
      if (next) {
        setOpenedForPath(pathname);
        setOpenIntent(true);
      } else {
        setOpenIntent(false);
      }
    },
    [pathname],
  );

  const close = useCallback(() => setOpenIntent(false), []);

  const toggle = useCallback(() => {
    if (open) {
      setOpenIntent(false);
    } else {
      setOpenedForPath(pathname);
      setOpenIntent(true);
    }
  }, [open, pathname]);

  // If viewport grows to md+, force-close (no drawer on desktop).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setOpenIntent(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Body scroll lock only while drawer is open (mobile).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Restore focus to the menu button after close.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      document.getElementById(NAV_MENU_BUTTON_ID)?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <NavChromeContext.Provider
      value={{ open, setOpen, toggle, close, navId }}
    >
      {children}
    </NavChromeContext.Provider>
  );
}

export function useNavChrome() {
  const ctx = useContext(NavChromeContext);
  if (!ctx) {
    throw new Error("useNavChrome must be used within NavChromeProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside chrome (e.g. tests). */
export function useNavChromeOptional() {
  return useContext(NavChromeContext);
}
