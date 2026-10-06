"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { IntegrationConnectionState } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

export function ConnectionBadge({
  connection,
  pending,
}: {
  connection: IntegrationConnectionState;
  pending?: boolean;
}) {
  const t = useTranslations("settings.connection");
  const format = useFormatter();
  const status = pending ? "syncing" : connection.status;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-medium",
          status === "ok" && "bg-emerald-500/15 text-emerald-400",
          status === "error" && "bg-red-500/15 text-red-400",
          status === "syncing" && "bg-amber-500/15 text-amber-400",
          status === "never" && "bg-(--muted) text-(--muted-fg)",
        )}
      >
        {t(status)}
      </span>
      {connection.lastSyncedAt ? (
        <span className="text-(--muted-fg)">
          {t("lastSync", {
            date: format.dateTime(new Date(connection.lastSyncedAt), {
              dateStyle: "short",
              timeStyle: "short",
            }),
          })}
        </span>
      ) : null}
      {status === "error" && connection.lastError ? (
        <span className="text-red-400">{connection.lastError}</span>
      ) : null}
    </div>
  );
}
