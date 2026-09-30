"use client";

import { useCallback, useEffect, useState } from "react";
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
  const resolveDefaultMailbox = (): CompanyMailbox => {
    if (
      typeof defaultMailboxAddress === "string" &&
      isCompanyMailbox(defaultMailboxAddress)
    ) {
      return defaultMailboxAddress;
    }
    return defaultMailbox();
  };

  const [mailbox, setMailbox] = useState<CompanyMailbox>(resolveDefaultMailbox);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialDraft) {
      setMailbox(
        isCompanyMailbox(initialDraft.mailbox_address)
          ? initialDraft.mailbox_address
          : defaultMailbox(),
      );
      setTo(initialDraft.to_address);
      setSubject(initialDraft.subject);
      setBody(initialDraft.body_text);
      setDraftId(initialDraft.id);
    } else {
      setMailbox(resolveDefaultMailbox());
      setTo("");
      setSubject("");
      setBody("");
      setDraftId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening / draft changes
  }, [open, initialDraft?.id]);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      const draft = data.draft as EmailDraft;
      setDraftId(draft.id);
      onDraftSaved(draft);
      toast.success("Borrador guardado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }, [draftId, mailbox, to, subject, body, onDraftSaved]);

  const handleSend = useCallback(async () => {
    if (!to.trim()) {
      toast.error("Indica el destinatario");
      return;
    }
    if (!body.trim()) {
      toast.error("Escribe el cuerpo del mensaje");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar");
      toast.success("Correo enviado");
      onOpenChange(false);
      onSent(data.threadId as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setBusy(false);
    }
  }, [mailbox, to, subject, body, draftId, onOpenChange, onSent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-3">
        <DialogHeader>
          <DialogTitle>Nuevo mensaje</DialogTitle>
          <DialogDescription>
            Se envía desde tu correo de empresa vía Resend. Sin Gmail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            De
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
            Para
            <Input
              className="mt-1"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinatario@ejemplo.com"
              disabled={busy}
              autoComplete="off"
            />
          </label>

          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            Asunto
            <Input
              className="mt-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto"
              disabled={busy}
            />
          </label>

          <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            Mensaje
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
            Guardar borrador
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleSend()}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
