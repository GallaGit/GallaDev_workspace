"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isAdminRole, isAppRole, isLeadWriter, type AppRole } from "@/lib/auth";

export type SessionAccess = {
  role: AppRole | null;
  ready: boolean;
  canWriteLeads: boolean;
  isAdmin: boolean;
  userId: string | null;
  /** Sesión de demo: no es Admin, Seller ni Viewer. */
  isVisitor: boolean;
};

const LOCKED: SessionAccess = {
  role: null,
  ready: false,
  canWriteLeads: false,
  isAdmin: false,
  userId: null,
  isVisitor: false,
};

const SessionAccessContext = createContext<SessionAccess>(LOCKED);

export function SessionAccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [access, setAccess] = useState<{
    path: string;
    value: SessionAccess;
  }>({ path: "", value: LOCKED });

  useEffect(() => {
    if (pathname === "/login") return;

    let cancelled = false;
    fetch("/api/session")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          id?: unknown;
          role?: unknown;
          visitor?: unknown;
        };
      })
      .then((data) => {
        if (cancelled) return;
        const role = data?.role;
        const value: SessionAccess =
          data?.visitor === true
            ? {
                role: null,
                ready: true,
                canWriteLeads: false,
                isAdmin: false,
                userId: null,
                isVisitor: true,
              }
            : isAppRole(role)
              ? {
                  role,
                  ready: true,
                  canWriteLeads: isLeadWriter(role),
                  isAdmin: isAdminRole(role),
                  userId: typeof data?.id === "string" ? data.id : null,
                  isVisitor: false,
                }
              : { ...LOCKED, ready: true };
        setAccess({ path: pathname, value });
      })
      .catch(() => {
        if (!cancelled) {
          setAccess({ path: pathname, value: { ...LOCKED, ready: true } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const value =
    pathname === "/login"
      ? { ...LOCKED, ready: true }
      : access.path === pathname
        ? access.value
        : LOCKED;

  return (
    <SessionAccessContext.Provider value={value}>
      {children}
    </SessionAccessContext.Provider>
  );
}

export function useSessionAccess(): SessionAccess {
  return useContext(SessionAccessContext);
}
