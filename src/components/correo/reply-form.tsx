"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Forward, Reply, ReplyAll, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readJsonResponse } from "@/lib/http/read-json";
import { buildOutboundInit } from "@/lib/email/outbound-client";
import { parseAddressList } from "@/lib/email/recipients";
import {
  hasContentBeyondSignature,
  initialBodyWithSignature,
} from "@/lib/email/signature";
import { AttachmentPicker } from "./attachment-picker";
import { RecipientsInput } from "./recipients-input";
import { fetchMailboxSignatures } from "./signatures-client";

type Mode = "reply" | "replyAll" | "forward";

/** Retraso del autoguardado del borrador de respuesta. */
export const REPLY_DRAFT_DEBOUNCE_MS = 1500;

interface ReplyDraft {
  id: string;
  body_text: string;
  reply_mode?: "reply" | "replyAll" | null;
}

const textareaClass =
  "w-full resize-y rounded-lg border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito px-3 py-2 text-[13px] text-grafito dark:text-gris-100 placeholder:text-gris-400 focus:border-rojo focus:outline-none focus:ring-1 focus:ring-rojo disabled:opacity-50";

export function ReplyForm({
  threadId,
  mailbox = "hola@galladev.com",
  onSent,
}: {
  threadId: string;
  mailbox?: string;
  onSent: () => void;
}) {
  const t = useTranslations("correo");
  const [mode, setMode] = useState<Mode>("reply");
  const [text, setText] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [sending, setSending] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showCopies, setShowCopies] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [validateCopies, setValidateCopies] = useState(false);
  const [signature, setSignature] = useState("");
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);

  // Restaurar el borrador de respuesta de este hilo al abrirlo. Si no hay
  // borrador, se parte de la firma del buzón (editable antes de enviar).
  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    (async () => {
      let restored = false;
      const signaturesPromise = fetchMailboxSignatures();
      try {
        const res = await fetch(`/api/email/drafts?threadId=${threadId}`);
        if (res.ok) {
          const data = (await res.json()) as { draft?: ReplyDraft | null };
          if (!cancelled && data.draft) {
            restored = true;
            setDraftId(data.draft.id);
            setText(data.draft.body_text ?? "");
            if (data.draft.reply_mode === "replyAll") setMode("replyAll");
            setDraftStatus("saved");
          }
        }
      } catch {
        // sin borrador: formulario vacío
      }
      const signatures = await signaturesPromise;
      if (cancelled) return;
      const mailboxSignature = signatures?.[mailbox] ?? "";
      setSignature(mailboxSignature);
      if (!restored && mailboxSignature) {
        setText((prev) =>
          prev.trim() === "" ? initialBodyWithSignature(mailboxSignature) : prev,
        );
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, mailbox]);

  // Autoguardado (solo respuestas; el reenvío no deja borrador).
  useEffect(() => {
    if (!loadedRef.current || !dirtyRef.current || mode === "forward" || sending) return;
    const handle = setTimeout(async () => {
      try {
        if (!hasContentBeyondSignature(text, signature)) {
          if (draftId) {
            await fetch(`/api/email/drafts/${draftId}`, { method: "DELETE" });
            setDraftId(null);
          }
          setDraftStatus("idle");
          return;
        }
        setDraftStatus("saving");
        const res = await fetch("/api/email/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(draftId ? { id: draftId } : {}),
            threadId,
            replyMode: mode,
            mailbox,
            to: "",
            subject: "",
            bodyText: text,
            leadId: null,
          }),
        });
        const data = await readJsonResponse<{ draft: ReplyDraft }>(res, t("draftSaveError"));
        setDraftId(data.draft.id);
        setDraftStatus("saved");
      } catch {
        setDraftStatus("idle");
      }
    }, REPLY_DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text, mode, draftId, threadId, mailbox, sending, signature, t]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    const hasText = hasContentBeyondSignature(text, signature);
    if (mode === "forward") {
      if (!forwardTo.trim()) {
        toast.error(t("forwardToRequired"));
        return;
      }
    } else if (!hasText) {
      toast.error(t("writeBeforeSend"));
      return;
    }
    const ccParsed = parseAddressList(cc);
    const bccParsed = parseAddressList(bcc);
    if (ccParsed.invalid.length > 0 || bccParsed.invalid.length > 0) {
      setValidateCopies(true);
      toast.error(
        t("compose.invalidAddresses", {
          field: ccParsed.invalid.length > 0 ? t("compose.cc") : t("compose.bcc"),
          addresses: [...ccParsed.invalid, ...bccParsed.invalid].join(", "),
        }),
      );
      return;
    }
    const copies: Record<string, unknown> = {};
    if (ccParsed.valid.length > 0) copies.cc = ccParsed.valid;
    if (bccParsed.valid.length > 0) copies.bcc = bccParsed.valid;

    setSending(true);
    try {
      if (mode === "forward") {
        const res = await fetch(
          `/api/email/threads/${threadId}/forward`,
          buildOutboundInit({ to: forwardTo.trim(), text: trimmed, ...copies }, files),
        );
        const data = await readJsonResponse<{ missing?: string[] }>(res, t("sendError"));
        toast.success(t("forwardSent"));
        if (data.missing && data.missing.length > 0) {
          toast.error(t("forwardMissingAttachments", { files: data.missing.join(", ") }));
        }
        setForwardTo("");
        setMode("reply");
      } else {
        const res = await fetch(
          `/api/email/threads/${threadId}/reply`,
          buildOutboundInit({ text: trimmed, mode, ...copies }, files),
        );
        await readJsonResponse(res, t("sendError"));
        toast.success(t("replySent"));
        // El servidor borra el borrador del hilo al enviar.
        setDraftId(null);
        setDraftStatus("idle");
      }
      dirtyRef.current = false;
      setText(initialBodyWithSignature(signature));
      setCc("");
      setBcc("");
      setFiles([]);
      setShowCopies(false);
      setValidateCopies(false);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sendError"));
    } finally {
      setSending(false);
    }
  }, [threadId, text, mode, forwardTo, cc, bcc, files, signature, onSent, t]);

  const modes: { key: Mode; label: string; Icon: typeof Reply }[] = [
    { key: "reply", label: t("reply"), Icon: Reply },
    { key: "replyAll", label: t("replyAll"), Icon: ReplyAll },
    { key: "forward", label: t("forward"), Icon: Forward },
  ];

  return (
    <div className="border-t border-gris-200 dark:border-gris-700 bg-gris-50 dark:bg-gris-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label={t("replyModes")}>
        {modes.map(({ key, label, Icon }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={mode === key ? "default" : "outline"}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
            disabled={sending}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {mode === "forward" ? (
        <div className="mb-2">
          <label htmlFor="forward-to" className="mb-1 block text-[12px] font-medium text-gris-600 dark:text-gris-300">
            {t("forwardTo")}
          </label>
          <input
            id="forward-to"
            type="email"
            value={forwardTo}
            onChange={(e) => setForwardTo(e.target.value)}
            disabled={sending}
            className={cn(textareaClass, "resize-none")}
          />
          <p className="mt-1 text-[11px] text-gris-500">{t("forwardHint")}</p>
        </div>
      ) : null}

      {showCopies ? (
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <RecipientsInput
            id="reply-cc"
            label={t("compose.cc")}
            value={cc}
            onChange={setCc}
            placeholder={t("compose.ccPlaceholder")}
            disabled={sending}
            forceValidate={validateCopies}
          />
          <RecipientsInput
            id="reply-bcc"
            label={t("compose.bcc")}
            value={bcc}
            onChange={setBcc}
            placeholder={t("compose.bccPlaceholder")}
            disabled={sending}
            forceValidate={validateCopies}
          />
        </div>
      ) : null}

      <label htmlFor="reply-text" className="mb-1 block text-[12px] font-medium text-gris-600 dark:text-gris-300">
        {mode === "forward" ? t("forwardNote") : t("replyAs", { mailbox })}
      </label>
      <textarea
        id="reply-text"
        value={text}
        onChange={(e) => {
          dirtyRef.current = true;
          setText(e.target.value);
        }}
        placeholder={t("replyPlaceholder")}
        rows={4}
        disabled={sending}
        className={textareaClass}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={showCopies}
          onClick={() => setShowCopies((v) => !v)}
          disabled={sending}
        >
          {t("replyExtras.toggle")}
        </Button>
      </div>
      <div className="mt-2">
        <AttachmentPicker
          files={files}
          onChange={setFiles}
          onError={(message) => toast.error(message)}
          disabled={sending}
          inputId="reply-attachments"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gris-500" aria-live="polite">
          {mode !== "forward" && draftStatus === "saving" ? t("draftSaving") : null}
          {mode !== "forward" && draftStatus === "saved" ? t("draftAutoSaved") : null}
        </span>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={
            sending ||
            (mode === "forward"
              ? !forwardTo.trim()
              : !hasContentBeyondSignature(text, signature))
          }
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </div>
  );
}
