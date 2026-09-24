import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import {
  PainAnalysisBlocks,
  PainAnalysisSkeletons,
} from "@/components/leads/pain-analysis-section";
import type { PainAnalysis } from "@/lib/ai/pain-analysis";

export function AiAnalysisPanel({
  analyzing,
  error,
  empty,
  analysis,
  onRetry,
  allowRetry = true,
  sectionRef,
}: {
  analyzing: boolean;
  error: string | null;
  empty: boolean;
  analysis: PainAnalysis | null;
  onRetry: () => void;
  allowRetry?: boolean;
  sectionRef?: Ref<HTMLElement>;
}) {
  return (
    <section ref={sectionRef}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg)">
        Dolores
      </h3>
      <div className="space-y-1.5">
        {analyzing ? <PainAnalysisSkeletons /> : null}

        {!analyzing && error ? (
          <div className="rounded-md border border-(--border) px-2.5 py-2">
            <p className="text-[12px] text-(--fg)">
              No se pudo detectar dolores. {error}
            </p>
            {allowRetry ? (
              <Button
                className="mt-2"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : null}

        {!analyzing && !error && empty ? (
          <div>
            <p className="text-[12px] text-(--muted-fg)">
              No hay señales suficientes en este lead.
            </p>
            {allowRetry ? (
              <p className="mt-1 text-[11px] text-(--muted-fg)">
                Añade web, servicios o notas y vuelve a intentar.
              </p>
            ) : null}
          </div>
        ) : null}

        {!analyzing && !error && !empty && !analysis ? (
          <p className="text-[12px] text-(--muted-fg)">
            {allowRetry
              ? "Aún no hay análisis. Pulsa Detectar dolores."
              : "Aún no hay análisis."}
          </p>
        ) : null}

        {!analyzing && !error && !empty && analysis ? (
          <PainAnalysisBlocks analysis={analysis} />
        ) : null}
      </div>
    </section>
  );
}
