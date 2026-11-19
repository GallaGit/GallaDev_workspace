"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSessionAccess } from "@/components/session-access";
import { fetchMailboxSignatures } from "@/components/correo/signatures-client";
import { COMPANY_MAILBOXES, type CompanyMailbox } from "@/lib/email/mailboxes";
import { MAX_SIGNATURE_CHARS } from "@/lib/email/signature";

/**
 * Ajustes → Firmas de correo. Solo Admin. Una firma de texto por buzón
 * (hola@ / ociel@) que el diálogo «Nuevo mensaje» y el formulario de respuesta
 * añaden al cuerpo; el usuario puede editarla antes de enviar.
 */
export function SettingsSignatures() {
  const t = useTranslations("settings");
  const { isAdmin, ready } = useSessionAccess();
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [mailbox, setMailbox] = useState<CompanyMailbox>(COMPANY_MAILBOXES[0]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    let cancelled = false;
    void fetchMailboxSignatures().then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setError(t("signaturesPanel.loadError"));
        return;
      }
      setSignatures(loaded);
      setSaved(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, ready, t]);

  if (!ready || !isAdmin) return null;

  const value = signatures[mailbox] ?? "";
  const dirty = value.trim() !== (saved[mailbox] ?? "").trim();

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email/signatures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailbox, signature: value }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        signature?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error || t("signaturesPanel.saveError"));
        return;
      }
      const stored = data?.signature ?? value.trim();
      setSignatures((prev) => ({ ...prev, [mailbox]: stored }));
      setSaved((prev) => ({ ...prev, [mailbox]: stored }));
      setNotice(t("signaturesPanel.saved"));
    } catch {
      setError(t("signaturesPanel.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="firmas-heading"
      className="rounded-lg border border-border bg-panel p-4"
    >
      <h3 id="firmas-heading" className="text-sm font-semibold text-fg">
        {t("signaturesPanel.title")}
      </h3>
      <p className="mt-1 text-sm text-muted-fg">{t("signaturesPanel.description")}</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-muted-fg">
          {notice}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        <label className="block text-xs text-muted-fg" htmlFor="signature-mailbox">
          {t("signaturesPanel.mailbox")}
        </label>
        <select
          id="signature-mailbox"
          className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
          value={mailbox}
          onChange={(e) => {
            setMailbox(e.target.value as CompanyMailbox);
            setNotice(null);
          }}
          disabled={saving}
        >
          {COMPANY_MAILBOXES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="signature-text">
          {t("signaturesPanel.signatureOf", { mailbox })}
        </label>
        <textarea
          id="signature-text"
          className="min-h-24 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
          value={value}
          maxLength={MAX_SIGNATURE_CHARS}
          placeholder={t("signaturesPanel.placeholder")}
          onChange={(e) => {
            setSignatures((prev) => ({ ...prev, [mailbox]: e.target.value }));
            setNotice(null);
          }}
          disabled={saving}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-fg">
            {t("signaturesPanel.charCount", {
              count: value.length,
              max: MAX_SIGNATURE_CHARS,
            })}
          </span>
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? t("saving") : t("signaturesPanel.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
