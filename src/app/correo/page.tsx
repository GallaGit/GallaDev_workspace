"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InboxPage } from "@/components/correo/inbox-page";
import { isUuid } from "@/lib/supabase/lead-lookup";

function CorreoContent() {
  const thread = useSearchParams().get("thread");
  return <InboxPage initialThreadId={thread && isUuid(thread) ? thread : null} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CorreoContent />
    </Suspense>
  );
}
