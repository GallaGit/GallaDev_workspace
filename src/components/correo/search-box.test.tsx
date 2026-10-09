import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { SearchBox, useDebouncedValue } from "./search-box";

beforeEach(() => {
  cleanup();
});

function Harness({ onAll = () => {} }: { onAll?: (v: boolean) => void }) {
  const [value, setValue] = useState("");
  const [all, setAll] = useState(false);
  return (
    <SearchBox
      value={value}
      onChange={setValue}
      searchAll={all}
      onSearchAllChange={(v) => {
        setAll(v);
        onAll(v);
      }}
    />
  );
}

describe("SearchBox", () => {
  it("escribe, borra con el botón y con Escape", () => {
    renderWithIntl(<Harness />);
    const input = screen.getByRole("searchbox", { name: "Buscar en el correo" }) as HTMLInputElement;
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).toBeNull();
    fireEvent.change(input, { target: { value: "factura" } });
    expect(input.value).toBe("factura");
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "ana" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
    expect(input.maxLength).toBe(200);
  });

  it("casilla de todas las bandejas", () => {
    const onAll = vi.fn();
    renderWithIntl(<Harness onAll={onAll} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Buscar en todas las bandejas" }));
    expect(onAll).toHaveBeenCalledWith(true);
  });
});

describe("useDebouncedValue", () => {
  it("solo emite tras el retraso", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
        initialProps: { v: "a" },
      });
      rerender({ v: "ab" });
      rerender({ v: "abc" });
      expect(result.current).toBe("a");
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(result.current).toBe("a");
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe("abc");
    } finally {
      vi.useRealTimers();
    }
  });
});
