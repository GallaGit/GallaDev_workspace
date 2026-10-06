import { useTranslations } from "next-intl";
import type { PainAnalysis } from "@/lib/ai/pain-analysis";

const SECTION_ORDER = [
  "evidence",
  "inference",
  "speculation",
] as const satisfies ReadonlyArray<keyof PainAnalysis>;

export function PainAnalysisBlocks({ analysis }: { analysis: PainAnalysis }) {
  const t = useTranslations("leads.ai");

  return (
    <div className="divide-y divide-(--border)">
      {SECTION_ORDER.map((key) => {
        const items = analysis[key].slice(0, 5);
        return (
          <div
            key={key}
            className={
              key === "inference"
                ? "border-l-2 border-l-(--accent) py-2 pl-2.5"
                : "py-2"
            }
          >
            <div className="flex items-center gap-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg)">
                {t(key)}
              </h4>
              {key === "speculation" ? (
                <span className="rounded border border-(--border) px-1 py-px text-[10px] leading-none text-(--muted-fg)">
                  {t("hypothesis")}
                </span>
              ) : null}
            </div>
            {items.length > 0 ? (
              <ul
                className={
                  key === "speculation"
                    ? "mt-1 space-y-1 text-[12.5px] text-(--muted-fg)"
                    : "mt-1 space-y-1 text-[12.5px] text-(--fg)"
                }
              >
                {items.map((item) => (
                  <li key={item} className="break-words">
                    • {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12.5px] text-(--muted-fg)">—</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PainAnalysisSkeletons() {
  const t = useTranslations("leads.ai");

  return (
    <div className="divide-y divide-(--border)">
      {SECTION_ORDER.map((key) => (
        <div key={key} className="flex h-12 flex-col justify-center">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-(--muted-fg) opacity-60">
            {t(key)}
          </h4>
          <div className="mt-1 h-4 animate-pulse rounded bg-(--muted)" />
        </div>
      ))}
    </div>
  );
}
