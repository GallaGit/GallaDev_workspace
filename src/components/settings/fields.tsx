"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import type { MaskedField, ValueSource } from "@/lib/settings/types";

function useSourceLabel() {
  const t = useTranslations("settings.sources");
  return (source: ValueSource) => {
    switch (source) {
      case "file":
        return t("file");
      case "env":
        return t("env");
      case "default":
        return t("default");
      default:
        return t("none");
    }
  };
}

export function SecretField({
  id,
  label,
  hint,
  field,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  id: string;
  label: string;
  hint?: string;
  field: MaskedField;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("settings");
  const sourceLabel = useSourceLabel();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-medium text-(--muted-fg)"
      >
        {label}
      </label>
      {field.configured ? (
        <p className="mb-1 text-[11px] text-(--muted-fg)">
          {t("configured", {
            preview: field.preview ?? "",
            source: sourceLabel(field.source),
          })}
        </p>
      ) : (
        <p className="mb-1 text-[11px] text-(--muted-fg)">{t("notConfigured")}</p>
      )}
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("newValue")}
        disabled={disabled}
      />
      <p className="mt-1 text-[11px] text-(--muted-fg)">
        {hint ?? t("emptySecret")}
      </p>
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-medium text-(--muted-fg)"
      >
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {hint ? (
        <p className="mt-1 text-[11px] text-(--muted-fg)">{hint}</p>
      ) : null}
    </div>
  );
}
