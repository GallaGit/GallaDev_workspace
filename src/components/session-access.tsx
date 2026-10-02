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
  /** Autenticado sin rol de app. No puede leer leads. */
  pending: boolean;
};

const LOCKED: SessionAccess = {
  role: null,
  ready: false,
  canWriteLeads: false,
  isAdmin: false,
  userId: null,
  isVisitor: false,
  pending: false,
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
        const data = (await res.json().catch(() => null)) as {
          id?: unknown;
          role?: unknown;
          visitor?: unknown;
          code?: unknown;
        } | null;
        if (!res.ok) {
          return data?.code === "no_profile" ? { pending: true as const } : null;
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const role = data && "role" in data ? data.role : undefined;
        const value: SessionAccess =
          data && "pending" in data && data.pending === true
            ? {
                role: null,
                ready: true,
                canWriteLeads: false,
                isAdmin: false,
                userId: null,
                isVisitor: false,
                pending: true,
              }
            : data && "visitor" in data && data.visitor === true
            ? {
                role: null,
                ready: true,
                canWriteLeads: false,
                isAdmin: false,
                userId: null,
                isVisitor: true,
                pending: false,
              }
            : isAppRole(role)
              ? {
                  role,
                  ready: true,
                  canWriteLeads: isLeadWriter(role),
                  isAdmin: isAdminRole(role),
                  userId:
                    data && "id" in data && typeof data.id === "string"
                      ? data.id
                      : null,
                  isVisitor: false,
                  pending: false,
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
