import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { vi } from "vitest";

// @testing-library/jest-dom/vitest registra cleanup automáticamente.
// El afterEach manual con cleanup() provocaba "failed to find the current suite"
// en Vitest 4.1.11 + @testing-library/react 16.3.3 con pool threads.

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "localStorage", {
  writable: true,
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();
HTMLDialogElement.prototype.show = vi.fn();

HTMLElement.prototype.scrollIntoView = vi.fn();
HTMLElement.prototype.focus = vi.fn();
HTMLElement.prototype.blur = vi.fn();

vi.stubGlobal(
  "ResizeObserver",
  vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
);

vi.mock("next/image", () => ({
  default: function NextImage({
    alt = "",
    src,
    width,
    height,
    className,
    ...rest
  }: {
    alt?: string;
    src?: string | { src: string };
    width?: number;
    height?: number;
    className?: string;
    [key: string]: unknown;
  }) {
    const imgRest = { ...rest };
    delete imgRest.priority;
    delete imgRest.fill;
    delete imgRest.unoptimized;
    return createElement("img", {
      alt,
      src: typeof src === "string" ? src : src?.src,
      width,
      height,
      className,
      ...imgRest,
    });
  },
}));
