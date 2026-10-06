"use client";

import { toast } from "sonner";
import type { AutomationDispatchResult } from "@/lib/automations/dispatch-result";

type AutomationsToastMessages = {
  dispatched: string;
  dispatchedMany: (count: number) => string;
};

export function toastAutomationDispatch(
  automation: AutomationDispatchResult | undefined,
  messages: Pick<AutomationsToastMessages, "dispatched">,
): void {
  if (automation?.status === "dispatched") {
    toast.message(messages.dispatched);
  }
}

export function toastAutomationBulk(
  automation: { dispatched?: number } | undefined,
  messages: AutomationsToastMessages,
): void {
  const n = automation?.dispatched ?? 0;
  if (n <= 0) return;
  toast.message(
    n === 1 ? messages.dispatched : messages.dispatchedMany(n),
  );
}
