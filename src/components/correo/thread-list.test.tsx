import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { ThreadList } from "./thread-list";
import type { EmailThread } from "./inbox-page";

function thread(overrides: Partial<EmailThread>): EmailThread {
  return {
    id: "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd",
    subject: "Presupuesto web",
    from_address: "ana@example.com",
    from_name: "Ana",
    mailbox_address: "hola@galladev.com",
    last_message_at: "2026-10-02T12:00:00.000Z",
    is_read: true,
    message_count: 1,
    lead_id: null,
    created_at: "2026-10-02T12:00:00.000Z",
    archived_at: null,
    trashed_at: null,
    last_snippet: null,
    has_attachments: false,
    ...overrides,
  };
}

const UNREAD = thread({
  id: "11111111-1111-4111-8111-111111111111",
  from_name: "Bea",
  subject: "Factura",
  is_read: false,
  last_snippet: "Te adjunto la factura de septiembre",
  has_attachments: true,
  message_count: 3,
});
const READ = thread({ id: "22222222-2222-4222-8222-222222222222" });

beforeEach(() => {
  cleanup();
});

describe("ThreadList", () => {
  it("una fila por hilo con remitente, asunto, fragmento y clip", () => {
    renderWithIntl(
      <ThreadList threads={[UNREAD, READ]} selectedId={null} onSelect={() => {}} />,
    );
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByText("Bea")).toBeTruthy();
    expect(first.getByText("Factura")).toBeTruthy();
    expect(first.getByText("Te adjunto la factura de septiembre")).toBeTruthy();
    expect(first.getByRole("img", { name: "Tiene adjuntos" })).toBeTruthy();
    expect(first.getByText("3")).toBeTruthy();
    expect(within(rows[1]).queryByRole("img", { name: "Tiene adjuntos" })).toBeNull();
  });

  it("negrita y marca accesible en no leídos", () => {
    renderWithIntl(
      <ThreadList threads={[UNREAD, READ]} selectedId={null} onSelect={() => {}} />,
    );
    const [unreadRow, readRow] = screen.getAllByRole("option");
    expect(unreadRow.getAttribute("data-unread")).toBe("true");
    expect(within(unreadRow).getByText("Bea").className).toContain("font-semibold");
    expect(within(unreadRow).getByText("Factura").className).toContain("font-semibold");
    expect(within(unreadRow).getByText("No leído")).toBeTruthy();
    expect(readRow.getAttribute("data-unread")).toBeNull();
    expect(within(readRow).getByText("Ana").className).not.toContain("font-semibold");
    expect(within(readRow).getByText("Leído")).toBeTruthy();
  });

  it("la casilla selecciona sin abrir el hilo", () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    renderWithIntl(
      <ThreadList
        threads={[UNREAD, READ]}
        selectedId={null}
        onSelect={onSelect}
        checkedIds={new Set([READ.id])}
        onToggleChecked={onToggle}
      />,
    );
    const boxBea = screen.getByRole("checkbox", { name: "Seleccionar hilo de Bea" });
    const boxAna = screen.getByRole("checkbox", {
      name: "Seleccionar hilo de Ana",
    }) as HTMLInputElement;
    expect(boxAna.checked).toBe(true);
    fireEvent.click(boxBea);
    expect(onToggle).toHaveBeenCalledWith(UNREAD.id);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Factura"));
    expect(onSelect).toHaveBeenCalledWith(UNREAD.id);
  });

  it("sin onToggleChecked no pinta casillas", () => {
    renderWithIntl(
      <ThreadList threads={[READ]} selectedId={READ.id} onSelect={() => {}} />,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("option").getAttribute("aria-selected")).toBe("true");
  });
});
