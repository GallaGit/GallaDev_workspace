import { useMemo, useSyncExternalStore } from "react";
import { vi } from "vitest";

/**
 * Doble de `next/navigation` para el módulo /correo: lee la URL real de jsdom
 * y se entera de pushState/replaceState (como hace el router de Next).
 *
 *   vi.mock("next/navigation", async () =>
 *     (await import("@/test/correo-route")).navigationMock);
 */

const listeners = new Set<() => void>();
const original = {
  pushState: window.history.pushState.bind(window.history),
  replaceState: window.history.replaceState.bind(window.history),
};

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export const routerPush = vi.fn();
export const routerReplace = vi.fn();

export function installCorreoRouter(url: string): void {
  window.history.pushState = (data, unused, next) => {
    original.pushState(data, unused, next);
    emit();
  };
  window.history.replaceState = (data, unused, next) => {
    original.replaceState(data, unused, next);
    emit();
  };
  original.replaceState(null, "", url);
  routerPush.mockClear();
  routerReplace.mockClear();
}

export function uninstallCorreoRouter(): void {
  window.history.pushState = original.pushState;
  window.history.replaceState = original.replaceState;
}

export function currentUrl(): string {
  return snapshot();
}

export const navigationMock = {
  usePathname: () => {
    const url = useSyncExternalStore(subscribe, snapshot, snapshot);
    return url.split("?")[0];
  },
  useSearchParams: () => {
    const url = useSyncExternalStore(subscribe, snapshot, snapshot);
    const search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    return useMemo(() => new URLSearchParams(search), [search]);
  },
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
};
