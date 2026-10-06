"use client";

import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { SettingsIntegrations } from "@/components/settings/settings-integrations";
import { SettingsSecurity } from "@/components/settings/settings-security";
import { SettingsTeam } from "@/components/settings/settings-team";

export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <>
      <Topbar title={t("title")} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
          <h2 className="text-sm font-semibold">{t("integrations")}</h2>
          <SettingsTeam />
          <SettingsIntegrations />
          <SettingsSecurity />
        </div>
      </div>
    </>
  );
}
