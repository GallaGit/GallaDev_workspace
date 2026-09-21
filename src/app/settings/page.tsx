"use client";

import { Topbar } from "@/components/layout/topbar";
import { SettingsIntegrations } from "@/components/settings/settings-integrations";
import { SettingsSecurity } from "@/components/settings/settings-security";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
        <h2 className="text-sm font-semibold">Integraciones</h2>
        <SettingsIntegrations />
        <SettingsSecurity />
      </div>
    </>
  );
}
