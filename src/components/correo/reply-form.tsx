"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Forward, Reply, ReplyAll, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readJsonResponse } from "@/lib/http/read-json";

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
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);

  // Restaurar el borrador de respuesta de este hilo al abrirlo.
  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    (async () => {
      try {
        const res = await fetch(`/api/email/drafts?threadId=${threadId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { draft?: ReplyDraft | null };
        if (cancelled || !data.draft) return;
        setDraftId(data.draft.id);
        setText(data.draft.body_text ?? "");
        if (data.draft.reply_mode === "replyAll") setMode("replyAll");
        setDraftStatus("saved");
      } catch {
        // sin borrador: formulario vacío
      } finally {
        if (!cancelled) loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Autoguardado (solo respuestas; el reenvío no deja borrador).
  useEffect(() => {
    if (!loadedRef.current || !dirtyRef.current || mode === "forward" || sending) return;
    const handle = setTimeout(async () => {
      try {
        if (!text.trim()) {
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
  }, [text, mode, draftId, threadId, mailbox, sending, t]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (mode === "forward") {
      if (!forwardTo.trim()) {
        toast.error(t("forwardToRequired"));
        return;
      }
    } else if (!trimmed) {
      toast.error(t("writeBeforeSend"));
      return;
    }

    setSending(true);
    try {
      if (mode === "forward") {
        const res = await fetch(`/api/email/threads/${threadId}/forward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: forwardTo.trim(), text: trimmed }),
        });
        const data = await readJsonResponse<{ missing?: string[] }>(res, t("sendError"));
        toast.success(t("forwardSent"));
        if (data.missing && data.missing.length > 0) {
          toast.error(t("forwardMissingAttachments", { files: data.missing.join(", ") }));
        }
        setForwardTo("");
        setMode("reply");
      } else {
        const res = await fetch(`/api/email/threads/${threadId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, mode }),
        });
        await readJsonResponse(res, t("sendError"));
        toast.success(t("replySent"));
        // El servidor borra el borrador del hilo al enviar.
        setDraftId(null);
        setDraftStatus("idle");
      }
      dirtyRef.current = false;
      setText("");
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sendError"));
    } finally {
      setSending(false);
    }
  }, [threadId, text, mode, forwardTo, onSent, t]);

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
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gris-500" aria-live="polite">
          {mode !== "forward" && draftStatus === "saving" ? t("draftSaving") : null}
          {mode !== "forward" && draftStatus === "saved" ? t("draftAutoSaved") : null}
        </span>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={
            sending || (mode === "forward" ? !forwardTo.trim() : !text.trim())
          }
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </div>
  );
}
