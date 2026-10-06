"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COMPANY_MAILBOXES,
  defaultMailbox,
  isCompanyMailbox,
  type CompanyMailbox,
} from "@/lib/email/mailboxes";
import { readJsonResponse } from "@/lib/http/read-json";

export interface EmailDraft {
  id: string;
  mailbox_address: string;
  to_address: string;
  subject: string;
  body_text: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

function resolveMailbox(
  defaultMailboxAddress?: CompanyMailbox | "all" | string,
  draft?: EmailDraft | null,
): CompanyMailbox {
  if (draft && isCompanyMailbox(draft.mailbox_address)) {
    return draft.mailbox_address;
  }
  if (
    typeof defaultMailboxAddress === "string" &&
    isCompanyMailbox(defaultMailboxAddress)
  ) {
    return defaultMailboxAddress;
  }
  return defaultMailbox();
}

export function ComposeDialog({
  open,
  onOpenChange,
  defaultMailboxAddress,
  initialDraft,
  onSent,
  onDraftSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMailboxAddress?: CompanyMailbox | "all" | string;
  initialDraft?: EmailDraft | null;
  onSent: (threadId: string) => void;
  onDraftSaved: (draft: EmailDraft) => void;
}) {
  const t = useTranslations("correo");
  // Parent remounts with key when draft/open changes — no sync effect.
  const [mailbox, setMailbox] = useState<CompanyMailbox>(() =>
    resolveMailbox(defaultMailboxAddress, initialDraft),
  );
  const [to, setTo] = useState(() => initialDraft?.to_address ?? "");
  const [subject, setSubject] = useState(() => initialDraft?.subject ?? "");
  const [body, setBody] = useState(() => initialDraft?.body_text ?? "");
  const [draftId, setDraftId] = useState<string | null>(
    () => initialDraft?.id ?? null,
  );
  const [busy, setBusy] = useState(false);

  const handleSaveDraft = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/email/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId ?? undefined,
          mailbox,
          to,
          subject,
          bodyText: body,
        }),
      });
      const data = await readJsonResponse<{ draft: EmailDraft }>(
        res,
        t("compose.saveError"),
      );
      const draft = data.draft;
      setDraftId(draft.id);
      onDraftSaved(draft);
      toast.success(t("compose.draftSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("compose.saveError"));
    } finally {
      setBusy(false);
    }
  }, [draftId, mailbox, to, subject, body, onDraftSaved, t]);

  const handleSend = useCallback(async () => {
    if (!to.trim()) {
      toast.error(t("compose.recipientRequired"));
      return;
    }
    if (!body.trim()) {
      toast.error(t("compose.bodyRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/email/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailbox,
          to: to.trim(),
          subject: subject.trim(),
          text: body.trim(),
          draftId: draftId ?? undefined,
        }),
      });
      const data = await readJsonResponse<{ threadId: string }>(
        res,
        t("sendError"),
      );
      toast.success(t("compose.sent"));
      onOpenChange(false);
      onSent(data.threadId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sendError"));
    } finally {
      setBusy(false);
    }
  }, [mailbox, to, subject, body, draftId, onOpenChange, onSent, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-3">
        <DialogHeader>
          <DialogTitle>{t("compose.title")}</DialogTitle>
          <DialogDescription>{t("compose.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            {t("compose.from")}
            <select
              className="mt-1 w-full rounded border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito px-2 py-1.5 text-[13px]"
              value={mailbox}
              onChange={(e) =>
                setMailbox(e.target.value as CompanyMailbox)
              }
              disabled={busy}
            >
              {COMPANY_MAILBOXES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            {t("compose.to")}
            <Input
              className="mt-1"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={t("compose.recipientPlaceholder")}
              disabled={busy}
              autoComplete="off"
            />
          </label>

          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            {t("compose.subject")}
            <Input
              className="mt-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("compose.subject")}
              disabled={busy}
            />
          </label>

          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            {t("compose.message")}
            <textarea
              className="mt-1 min-h-36 w-full resize-y rounded border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito px-2 py-1.5 text-[13px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void handleSaveDraft()}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            {t("compose.saveDraft")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleSend()}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            {busy ? t("compose.sending") : t("compose.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
