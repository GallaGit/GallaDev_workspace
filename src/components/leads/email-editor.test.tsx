import { beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { EmailEditor } from "@/components/leads/email-editor";

vi.mock("@/lib/utils/gmail-compose", () => ({
  openGmailCompose: vi.fn(),
}));

describe("EmailEditor", () => {
  beforeEach(() => cleanup());

  const defaultProps = {
    subject: "Test Subject",
    body: "Test body content",
    to: "lead@example.com",
    onSubjectChange: vi.fn(),
    onBodyChange: vi.fn(),
    onSave: vi.fn(),
    onCopy: vi.fn(),
    onMarkPrepared: vi.fn(),
    showApplyTemplate: true,
    onApplyTemplate: vi.fn(),
  };

  it("renders subject and body fields", () => {
    render(<EmailEditor {...defaultProps} />);
    expect(screen.getByPlaceholderText("Asunto")).toHaveValue("Test Subject");
    expect(screen.getByPlaceholderText("Cuerpo (texto plano)")).toHaveValue(
      "Test body content",
    );
  });

  it("calls onSubjectChange when subject changes", () => {
    render(<EmailEditor {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("Asunto"), {
      target: { value: "New Subject" },
    });
    expect(defaultProps.onSubjectChange).toHaveBeenCalledWith("New Subject");
  });

  it("calls onBodyChange when body changes", () => {
    render(<EmailEditor {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("Cuerpo (texto plano)"), {
      target: { value: "New body" },
    });
    expect(defaultProps.onBodyChange).toHaveBeenCalledWith("New body");
  });

  it("exposes save, copy and mark prepared actions", () => {
    render(<EmailEditor {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar email/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));
    fireEvent.click(screen.getByRole("button", { name: /marcar preparado/i }));
    expect(defaultProps.onSave).toHaveBeenCalled();
    expect(defaultProps.onCopy).toHaveBeenCalled();
    expect(defaultProps.onMarkPrepared).toHaveBeenCalled();
  });

  it("shows apply template when enabled", () => {
    render(<EmailEditor {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /aplicar plantilla/i }));
    expect(defaultProps.onApplyTemplate).toHaveBeenCalled();
  });
});
