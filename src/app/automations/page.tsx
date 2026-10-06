"use client";

import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { AutomationsPanel } from "@/components/automations/automations-panel";

export default function AutomationsPage() {
  const t = useTranslations("automations");
  return (
    <>
      <Topbar title={t("title")} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
          <AutomationsPanel />
        </div>
      </div>
    </>
  );
}
