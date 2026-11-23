"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAttachmentSize } from "@/lib/email/attachment-meta";
import {
  MAX_OUTBOUND_ATTACHMENT_BYTES,
  MAX_OUTBOUND_ATTACHMENTS,
  MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES,
  validateAttachmentSet,
  type AttachmentIssueCode,
} from "@/lib/email/outbound-attachments";

const ISSUE_KEYS: Record<AttachmentIssueCode, string> = {
  "too-many": "tooMany",
  "too-large": "tooLarge",
  "total-too-large": "totalTooLarge",
  blocked: "blocked",
  empty: "empty",
};

/**
 * Selector de adjuntos salientes. Los ficheros viven en memoria del
 * navegador y se envían con el correo; no se suben antes ni van al borrador.
 */
export function AttachmentPicker({
  files,
  onChange,
  onError,
  disabled,
  inputId = "compose-attachments",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  inputId?: string;
}) {
  const t = useTranslations("correo.compose");
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePick(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;
    const next = [...files, ...picked];
    const checked = validateAttachmentSet(
      next.map((file) => ({ name: file.name, size: file.size })),
    );
    if (!checked.ok) {
      onError(
        t(`attachmentError.${ISSUE_KEYS[checked.code]}`, {
          name: checked.name ?? "",
          count: MAX_OUTBOUND_ATTACHMENTS,
          max: formatAttachmentSize(
            checked.code === "total-too-large"
              ? MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES
              : MAX_OUTBOUND_ATTACHMENT_BYTES,
          ),
        }),
      );
      return;
    }
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          className="sr-only"
          aria-label={t("attach")}
          disabled={disabled}
          onChange={(e) => handlePick(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="mr-1 h-3.5 w-3.5" />
          {t("attach")}
        </Button>
        <span className="text-[11px] text-gris-500">
          {t("attachmentsHint", {
            count: MAX_OUTBOUND_ATTACHMENTS,
            file: formatAttachmentSize(MAX_OUTBOUND_ATTACHMENT_BYTES),
            total: formatAttachmentSize(MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES),
          })}
        </span>
      </div>
      {files.length > 0 ? (
        <ul aria-label={t("attachments")} className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-1 rounded border border-gris-200 dark:border-gris-700 px-2 py-0.5 text-[12px]"
            >
              <span className="max-w-48 truncate">{file.name}</span>
              <span className="text-gris-500">({formatAttachmentSize(file.size)})</span>
              <button
                type="button"
                className="text-gris-500 hover:text-rojo disabled:opacity-50"
                aria-label={t("removeAttachment", { name: file.name })}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
