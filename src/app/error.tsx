"use client";

import { AppErrorFallback } from "@/components/app-error-fallback";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <AppErrorFallback digest={error.digest} onRetry={retry} />;
}
