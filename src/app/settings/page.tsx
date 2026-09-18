"use client";

import { Topbar } from "@/components/layout/topbar";
import { SettingsIntake } from "@/components/settings/settings-intake";
import { SettingsIntegrations } from "@/components/settings/settings-integrations";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Captación</h2>
          <SettingsIntake />
        </div>
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Integraciones</h2>
          <SettingsIntegrations />
        </div>
      </div>
    </>
  );
}
