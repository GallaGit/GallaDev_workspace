import type { Ref } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("leads.ai");

  return (
    <section ref={sectionRef}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg)">
        {t("title")}
      </h3>
      <div className="space-y-1.5">
        {analyzing ? <PainAnalysisSkeletons /> : null}

        {!analyzing && error ? (
          <div className="rounded-md border border-(--border) px-2.5 py-2">
            <p className="text-[12px] text-(--fg)">
              {t("error", { error })}
            </p>
            {allowRetry ? (
              <Button
                className="mt-2"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                {t("retry")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {!analyzing && !error && empty ? (
          <div>
            <p className="text-[12px] text-(--muted-fg)">{t("empty")}</p>
            {allowRetry ? (
              <p className="mt-1 text-[11px] text-(--muted-fg)">
                {t("emptyHint")}
              </p>
            ) : null}
          </div>
        ) : null}

        {!analyzing && !error && !empty && !analysis ? (
          <p className="text-[12px] text-(--muted-fg)">
            {allowRetry ? t("notAnalyzed") : t("notAnalyzedReadOnly")}
          </p>
        ) : null}

        {!analyzing && !error && !empty && analysis ? (
          <PainAnalysisBlocks analysis={analysis} />
        ) : null}
      </div>
    </section>
  );
}
