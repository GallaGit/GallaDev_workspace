"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/http/read-json";

export function ReplyForm({
  threadId,
  onSent,
}: {
  threadId: string;
  onSent: () => void;
}) {
  const t = useTranslations("correo");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error(t("writeBeforeSend"));
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/email/threads/${threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      await readJsonResponse(res, t("sendError"));
      toast.success(t("replySent"));
      setText("");
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sendError"));
    } finally {
      setSending(false);
    }
  }, [threadId, text, onSent, t]);

  return (
    <div className="border-t border-gris-200 dark:border-gris-700 bg-gris-50 dark:bg-gris-900 p-4">
      <label htmlFor="reply-text" className="mb-1 block text-[12px] font-medium text-gris-600 dark:text-gris-300">
        {t("replyAs")}
      </label>
      <textarea
        id="reply-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("replyPlaceholder")}
        rows={4}
        disabled={sending}
        className="w-full resize-y rounded-lg border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito px-3 py-2 text-[13px] text-grafito dark:text-gris-100 placeholder:text-gris-400 focus:border-rojo focus:outline-none focus:ring-1 focus:ring-rojo disabled:opacity-50"
      />
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !text.trim()}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </div>
  );
}
