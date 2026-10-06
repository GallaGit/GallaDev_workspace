import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { PainAnalysisBlocks } from "@/components/leads/pain-analysis-section";
import type { PainAnalysis } from "@/lib/ai/pain-analysis";
import { renderWithIntl } from "@/test/i18n-wrapper";

describe("PainAnalysisBlocks", () => {
  const analysis: PainAnalysis = {
    evidence: ["Hecho 1", "Hecho 2"],
    inference: ["Inferencia 1"],
    speculation: ["Hipótesis 1"],
  };

  it("renders section labels", () => {
    renderWithIntl(<PainAnalysisBlocks analysis={analysis} />);
    expect(screen.getByRole("heading", { name: /evidencia/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /inferencia/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /especulación/i })).toBeInTheDocument();
  });

  it("renders analysis items", () => {
    const { container } = renderWithIntl(<PainAnalysisBlocks analysis={analysis} />);
    expect(container.textContent).toContain("Hecho 1");
    expect(container.textContent).toContain("Inferencia 1");
    expect(container.textContent).toContain("Hipótesis 1");
  });

  it("shows placeholders when a section is empty", () => {
    renderWithIntl(
      <PainAnalysisBlocks
        analysis={{ evidence: [], inference: [], speculation: [] }}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
