"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { DailyWorkPage } from "@/components/inbox/daily-work-page";

export default function Page() {
  const t = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-(--muted-fg)">{t("loading")}</div>
      }
    >
      <DailyWorkPage />
    </Suspense>
  );
}
