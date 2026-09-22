"use client";

import { Topbar } from "@/components/layout/topbar";
import { AutomationsPanel } from "@/components/automations/automations-panel";

export default function AutomationsPage() {
  return (
    <>
      <Topbar title="Automations" />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
          <AutomationsPanel />
        </div>
      </div>
    </>
  );
}
