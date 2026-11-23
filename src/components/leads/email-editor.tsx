"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type EmailEditorProps = {
  subject: string;
  body: string;
  to?: string | null;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  saving?: boolean;
  onSave: () => void;
  onCopy: () => void;
  onMarkPrepared: () => void;
  onApplyTemplate?: () => void;
  showApplyTemplate?: boolean;
  readOnly?: boolean;
};

export function EmailEditor({
  subject,
  body,
  to,
  onSubjectChange,
  onBodyChange,
  saving,
  onSave,
  onCopy,
  onMarkPrepared,
  onApplyTemplate,
  showApplyTemplate,
  readOnly = false,
}: EmailEditorProps) {
  const t = useTranslations("leads.emailEditor");

  return (
    <div>
      <Input
        className="mb-2"
        placeholder={t("subject")}
        value={subject}
        readOnly={readOnly}
        onChange={(e) => onSubjectChange(e.target.value)}
      />
      <Textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={10}
        placeholder={t("body")}
        readOnly={readOnly}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving || readOnly} onClick={onSave}>
          {t("save")}
        </Button>
        <Button size="sm" variant="outline" onClick={onCopy}>
          {t("copy")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={saving || readOnly}
          onClick={onMarkPrepared}
        >
          {t("markPrepared")}
        </Button>
        {showApplyTemplate && onApplyTemplate ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={readOnly}
            onClick={onApplyTemplate}
          >
            {t("applyTemplate")}
          </Button>
        ) : null}
      </div>
      {to ? (
        <p className="mt-2 text-[11px] text-muted-fg">
          {t("recipient", { email: to })}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-400">{t("missingEmail")}</p>
      )}
    </div>
  );
}
