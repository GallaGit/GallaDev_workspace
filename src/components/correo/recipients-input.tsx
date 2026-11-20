"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  MAX_RECIPIENTS_PER_FIELD,
  parseAddressList,
} from "@/lib/email/recipients";

/**
 * Campo de varias direcciones (CC / CCO) separadas por comas.
 * Valida al salir del campo (o cuando `forceValidate` es true).
 */
export function RecipientsInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  forceValidate = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  forceValidate?: boolean;
}) {
  const t = useTranslations("correo.compose");
  const [touched, setTouched] = useState(false);
  const parsed = parseAddressList(value);
  const tooMany = parsed.valid.length > MAX_RECIPIENTS_PER_FIELD;

  let error: string | undefined;
  if (touched || forceValidate) {
    if (parsed.invalid.length > 0) {
      error = t("invalidAddresses", {
        field: label,
        addresses: parsed.invalid.join(", "),
      });
    } else if (tooMany) {
      error = t("tooManyRecipients", { max: MAX_RECIPIENTS_PER_FIELD });
    }
  }

  return (
    <div className="block text-[12px] font-medium text-gris-600 dark:text-gris-300">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        className="mt-1"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        error={error}
        helperText={t("recipientsHint")}
      />
    </div>
  );
}
