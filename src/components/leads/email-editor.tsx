"use client";

import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { openGmailCompose } from "@/lib/utils/gmail-compose";

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
}: EmailEditorProps) {
  function redactarEnGmail() {
    if (!subject.trim() && !body.trim()) {
      toast.error("Añade asunto o cuerpo antes de redactar");
      return;
    }
    if (!to?.trim()) {
      toast.message("Sin destinatario: se abrirá Gmail sin campo Para");
    }
    openGmailCompose({ to, subject, body });
  }

  return (
    <div>
      <Input
        className="mb-2"
        placeholder="Asunto"
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
      />
      <Textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={10}
        placeholder="Cuerpo (texto plano)"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={redactarEnGmail}>
          <Mail className="h-3.5 w-3.5" />
          Redactar email
        </Button>
        <Button size="sm" disabled={saving} onClick={onSave}>
          Guardar email
        </Button>
        <Button size="sm" variant="outline" onClick={onCopy}>
          Copiar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={saving}
          onClick={onMarkPrepared}
        >
          Marcar preparado
        </Button>
        {showApplyTemplate && onApplyTemplate ? (
          <Button size="sm" variant="ghost" onClick={onApplyTemplate}>
            Aplicar plantilla
          </Button>
        ) : null}
      </div>
      {to ? (
        <p className="mt-2 text-[11px] text-muted-fg">
          Destinatario: {to}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-400">
          Este lead no tiene correo. Añádelo o complétalo en Gmail.
        </p>
      )}
    </div>
  );
}
