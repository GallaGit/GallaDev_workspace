"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send, Save, X } from "lucide-react";
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
import {
  exceedsRecipientTotal,
  MAX_RECIPIENTS_PER_FIELD,
  parseAddressList,
} from "@/lib/email/recipients";
import {
  hasContentBeyondSignature,
  initialBodyWithSignature,
  swapSignature,
} from "@/lib/email/signature";
import { buildOutboundInit } from "@/lib/email/outbound-client";
import { readJsonResponse } from "@/lib/http/read-json";
import { AttachmentPicker } from "./attachment-picker";
import { RecipientsInput } from "./recipients-input";
import { fetchMailboxSignatures } from "./signatures-client";

export interface EmailDraft {
  id: string;
  mailbox_address: string;
  to_address: string;
  cc_address?: string;
  bcc_address?: string;
  subject: string;
  body_text: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Espera tras la última edición antes de autoguardar el borrador. */
export const COMPOSE_AUTOSAVE_DEBOUNCE_MS = 2000;

type AutosaveStatus = "idle" | "saving" | "saved" | "error";

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
  variant = "dialog",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMailboxAddress?: CompanyMailbox | "all" | string;
  initialDraft?: EmailDraft | null;
  onSent: (threadId: string, draftId?: string) => void;
  onDraftSaved: (draft: EmailDraft, meta?: { auto: boolean }) => void;
  /**
   * `inline` pinta la redacción en el área de contenido del módulo (sin
   * modal) y se remonta por sesión; `dialog` es el modal de siempre.
   */
  variant?: "dialog" | "inline";
}) {
  const t = useTranslations("correo");
  // Parent remounts with key per compose session — no sync effect.
  const [mailbox, setMailbox] = useState<CompanyMailbox>(() =>
    resolveMailbox(defaultMailboxAddress, initialDraft),
  );
  const [to, setTo] = useState(() => initialDraft?.to_address ?? "");
  const [cc, setCc] = useState(() => initialDraft?.cc_address ?? "");
  const [bcc, setBcc] = useState(() => initialDraft?.bcc_address ?? "");
  const [subject, setSubject] = useState(() => initialDraft?.subject ?? "");
  const [body, setBody] = useState(() => initialDraft?.body_text ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [autosave, setAutosave] = useState<AutosaveStatus>(
    initialDraft ? "saved" : "idle",
  );
  const [validateCopies, setValidateCopies] = useState(false);
  const [signatures, setSignatures] = useState<Record<string, string>>({});

  const draftIdRef = useRef<string | null>(initialDraft?.id ?? null);
  const leadIdRef = useRef<string | null>(initialDraft?.lead_id ?? null);
  const signaturesRef = useRef<Record<string, string>>({});
  const activeSignatureRef = useRef("");
  const dirtyRef = useRef(false);
  const sentRef = useRef(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const fieldsRef = useRef({ mailbox, to, cc, bcc, subject, body });
  const onDraftSavedRef = useRef(onDraftSaved);
  const mailboxRef = useRef(mailbox);

  useEffect(() => {
    fieldsRef.current = { mailbox, to, cc, bcc, subject, body };
    mailboxRef.current = mailbox;
    onDraftSavedRef.current = onDraftSaved;
  });

  // Firma del buzón: solo se añade a mensajes nuevos (un borrador ya la lleva).
  const hasInitialDraft = Boolean(initialDraft);
  useEffect(() => {
    let cancelled = false;
    void fetchMailboxSignatures().then((signatures) => {
      if (cancelled || !signatures) return;
      signaturesRef.current = signatures;
      setSignatures(signatures);
      const signature = signatures[mailboxRef.current] ?? "";
      activeSignatureRef.current = signature;
      if (hasInitialDraft || !signature) return;
      const block = initialBodyWithSignature(signature);
      setBody((prev) => (prev.trim() === "" ? block : `${prev}${block}`));
    });
    return () => {
      cancelled = true;
    };
  }, [hasInitialDraft]);

  const hasMeaningfulContent = useCallback((): boolean => {
    const f = fieldsRef.current;
    return Boolean(
      f.to.trim() ||
        f.cc.trim() ||
        f.bcc.trim() ||
        f.subject.trim() ||
        hasContentBeyondSignature(f.body, activeSignatureRef.current),
    );
  }, []);

  // Guarda en serie: dos guardados nunca corren a la vez (evita borradores duplicados).
  const persistDraft = useCallback(
    (auto: boolean): Promise<EmailDraft | null> => {
      const run = async (): Promise<EmailDraft | null> => {
        const f = fieldsRef.current;
        const snapshot = JSON.stringify(f);
        if (auto && snapshot === savedSnapshotRef.current) return null;
        setAutosave("saving");
        try {
          const res = await fetch("/api/email/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: draftIdRef.current ?? undefined,
              mailbox: f.mailbox,
              to: f.to,
              cc: f.cc,
              bcc: f.bcc,
              subject: f.subject,
              bodyText: f.body,
              ...(leadIdRef.current ? { leadId: leadIdRef.current } : {}),
            }),
          });
          const data = await readJsonResponse<{ draft: EmailDraft }>(
            res,
            t("compose.saveError"),
          );
          draftIdRef.current = data.draft.id;
          if (data.draft.lead_id !== undefined) {
            leadIdRef.current = data.draft.lead_id;
          }
          savedSnapshotRef.current = snapshot;
          setAutosave("saved");
          onDraftSavedRef.current(data.draft, { auto });
          return data.draft;
        } catch (e) {
          setAutosave("error");
          if (!auto) {
            toast.error(e instanceof Error ? e.message : t("compose.saveError"));
          }
          return null;
        }
      };
      const next = queueRef.current.then(run, run);
      queueRef.current = next;
      return next;
    },
    [t],
  );

  // Autoguardado con debounce mientras se escribe.
  useEffect(() => {
    if (!dirtyRef.current || busy || sentRef.current) return;
    if (!hasMeaningfulContent()) return;
    const handle = setTimeout(() => {
      void persistDraft(true);
    }, COMPOSE_AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [mailbox, to, cc, bcc, subject, body, busy, hasMeaningfulContent, persistDraft]);

  const touch = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && dirtyRef.current && !busy && !sentRef.current && hasMeaningfulContent()) {
        void persistDraft(true);
      }
      onOpenChange(next);
    },
    [busy, hasMeaningfulContent, onOpenChange, persistDraft],
  );

  // En línea no hay cierre explícito al abrir un hilo: guarda al desmontar.
  const persistDraftRef = useRef(persistDraft);
  const busyRef = useRef(busy);
  useEffect(() => {
    persistDraftRef.current = persistDraft;
    busyRef.current = busy;
  });
  useEffect(() => {
    if (variant !== "inline") return;
    return () => {
      if (dirtyRef.current && !busyRef.current && !sentRef.current && hasMeaningfulContent()) {
        void persistDraftRef.current(true);
      }
    };
  }, [variant, hasMeaningfulContent]);

  const handleMailboxChange = useCallback(
    (next: CompanyMailbox) => {
      touch();
      const previousSignature = activeSignatureRef.current;
      const nextSignature = signaturesRef.current[next] ?? "";
      activeSignatureRef.current = nextSignature;
      setMailbox(next);
      setBody((prev) => swapSignature(prev, previousSignature, nextSignature));
    },
    [touch],
  );

  const handleSaveDraft = useCallback(async () => {
    setBusy(true);
    try {
      const draft = await persistDraft(false);
      if (draft) toast.success(t("compose.draftSaved"));
    } finally {
      setBusy(false);
    }
  }, [persistDraft, t]);

  const handleSend = useCallback(async () => {
    if (!to.trim()) {
      toast.error(t("compose.recipientRequired"));
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
    if (
      ccParsed.valid.length > MAX_RECIPIENTS_PER_FIELD ||
      bccParsed.valid.length > MAX_RECIPIENTS_PER_FIELD ||
      exceedsRecipientTotal({ to: [to], cc: ccParsed.valid, bcc: bccParsed.valid })
    ) {
      setValidateCopies(true);
      toast.error(t("compose.tooManyRecipients", { max: MAX_RECIPIENTS_PER_FIELD }));
      return;
    }
    if (!body.trim() || !hasContentBeyondSignature(body, activeSignatureRef.current)) {
      toast.error(t("compose.bodyRequired"));
      return;
    }
    setBusy(true);
    try {
      // Espera al autoguardado en curso: así se envía con el id de borrador real.
      await queueRef.current;
      const payload: Record<string, unknown> = {
        mailbox,
        to: to.trim(),
        subject: subject.trim(),
        text: body.trim(),
        draftId: draftIdRef.current ?? undefined,
      };
      if (ccParsed.valid.length > 0) payload.cc = ccParsed.valid;
      if (bccParsed.valid.length > 0) payload.bcc = bccParsed.valid;
      const res = await fetch("/api/email/compose", buildOutboundInit(payload, files));
      const data = await readJsonResponse<{ threadId: string }>(
        res,
        t("sendError"),
      );
      sentRef.current = true;
      toast.success(t("compose.sent"));
      onOpenChange(false);
      onSent(data.threadId, draftIdRef.current ?? undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sendError"));
    } finally {
      setBusy(false);
    }
  }, [mailbox, to, cc, bcc, subject, body, files, onOpenChange, onSent, t]);

  const signature = (signatures[mailbox] ?? "").trim();

  const fields = (
    <div className="space-y-3">
      <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
        {t("compose.from")}
        <select
          className="mt-1 w-full rounded border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito px-2 py-1.5 text-[13px]"
          value={mailbox}
          onChange={(e) =>
            handleMailboxChange(e.target.value as CompanyMailbox)
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
          onChange={(e) => {
            touch();
            setTo(e.target.value);
          }}
          placeholder={t("compose.recipientPlaceholder")}
          disabled={busy}
          autoComplete="off"
        />
      </label>

      <RecipientsInput
        id="compose-cc"
        label={t("compose.cc")}
        value={cc}
        onChange={(v) => {
          touch();
          setCc(v);
        }}
        placeholder={t("compose.ccPlaceholder")}
        disabled={busy}
        forceValidate={validateCopies}
      />

      <RecipientsInput
        id="compose-bcc"
        label={t("compose.bcc")}
        value={bcc}
        onChange={(v) => {
          touch();
          setBcc(v);
        }}
        placeholder={t("compose.bccPlaceholder")}
        disabled={busy}
        forceValidate={validateCopies}
      />

      <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
        {t("compose.subject")}
        <Input
          className="mt-1"
          value={subject}
          onChange={(e) => {
            touch();
            setSubject(e.target.value);
          }}
          placeholder={t("compose.subject")}
          disabled={busy}
        />
      </label>

      <label className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
        {t("compose.message")}
        <textarea
          className="mt-1 min-h-36 w-full resize-y rounded border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito px-2 py-1.5 text-[13px]"
          value={body}
          onChange={(e) => {
            touch();
            setBody(e.target.value);
          }}
          disabled={busy}
        />
      </label>
      {signature && body.includes(signature) ? (
        <p className="-mt-2 text-[11px] text-gris-500">
          {t("compose.signatureHint", { mailbox })}
        </p>
      ) : null}

      <AttachmentPicker
        files={files}
        onChange={setFiles}
        onError={(message) => toast.error(message)}
        disabled={busy}
      />
    </div>
  );

  const actions = (
    <>
      <span
        className="mr-auto text-[11px] text-gris-500"
        aria-live="polite"
        data-testid="compose-autosave-status"
      >
        {autosave === "saving" ? t("compose.autosaving") : null}
        {autosave === "saved" ? t("compose.autosaved") : null}
        {autosave === "error" ? t("compose.autosaveError") : null}
      </span>
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

      </>
  );

  if (variant === "inline") {
    if (!open) return null;
    return (
      <section
        className="flex h-full min-h-0 min-w-0 flex-col"
        aria-label={t("compose.title")}
        data-testid="compose-inline"
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-gris-200 px-4 py-3 dark:border-gris-700">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-grafito dark:text-gris-100">
              {t("compose.title")}
            </h2>
            <p className="text-[12px] text-gris-500 dark:text-gris-400">
              {t("compose.description")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleOpenChange(false)}
            aria-label={t("compose.close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-3">
          {fields}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gris-200 px-4 py-3 dark:border-gris-700">
          {actions}
        </footer>
      </section>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] gap-3 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("compose.title")}</DialogTitle>
          <DialogDescription>{t("compose.description")}</DialogDescription>
        </DialogHeader>

        {fields}

        <DialogFooter className="items-center gap-2 sm:gap-2">
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
