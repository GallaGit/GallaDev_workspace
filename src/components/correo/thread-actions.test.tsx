import { cleanup, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { BulkToolbar, StateActionButtons } from "./thread-actions";

function labels() {
  return screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
}

beforeEach(() => {
  cleanup();
});

describe("StateActionButtons", () => {
  it("Recibidos: no leído, archivar, papelera", () => {
    const onAction = vi.fn();
    renderWithIntl(<StateActionButtons view="inbox" isRead onAction={onAction} />);
    expect(labels()).toEqual(["Marcar como no leído", "Archivar", "Mover a la papelera"]);
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    expect(onAction).toHaveBeenLastCalledWith({ archived: true });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como no leído" }));
    expect(onAction).toHaveBeenLastCalledWith({ is_read: false });
  });

  it("Archivados: mover a Recibidos", () => {
    const onAction = vi.fn();
    renderWithIntl(<StateActionButtons view="archived" isRead={false} onAction={onAction} />);
    expect(labels()).toEqual(["Marcar como leído", "Mover a Recibidos", "Mover a la papelera"]);
    fireEvent.click(screen.getByRole("button", { name: "Mover a Recibidos" }));
    expect(onAction).toHaveBeenLastCalledWith({ archived: false });
  });

  it("Papelera: restaurar en vez de papelera", () => {
    const onAction = vi.fn();
    renderWithIntl(<StateActionButtons view="trash" onAction={onAction} />);
    expect(labels()).toEqual(["Restaurar"]);
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(onAction).toHaveBeenLastCalledWith({ trashed: false });
  });
});

describe("BulkToolbar", () => {
  it("deshabilita las acciones sin selección", () => {
    renderWithIntl(
      <BulkToolbar
        view="inbox"
        allChecked={false}
        someChecked={false}
        selectedCount={0}
        onToggleAll={() => {}}
        onAction={() => {}}
      />,
    );
    for (const name of ["Marcar como leído", "Marcar como no leído", "Archivar"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("muestra el número, marca indeterminado y lanza la acción", () => {
    const onAction = vi.fn();
    const onToggleAll = vi.fn();
    renderWithIntl(
      <BulkToolbar
        view="inbox"
        allChecked={false}
        someChecked
        selectedCount={2}
        onToggleAll={onToggleAll}
        onAction={onAction}
      />,
    );
    expect(screen.getByText("2 seleccionados")).toBeTruthy();
    const all = screen.getByRole("checkbox", { name: "Seleccionar todos" }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    fireEvent.click(all);
    expect(onToggleAll).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como leído" }));
    expect(onAction).toHaveBeenLastCalledWith({ is_read: true });
    fireEvent.click(screen.getByRole("button", { name: "Mover a la papelera" }));
    expect(onAction).toHaveBeenLastCalledWith({ trashed: true });
  });
});
