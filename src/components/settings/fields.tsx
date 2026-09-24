"use client";

import { Input } from "@/components/ui/input";
import { sourceLabel } from "@/lib/settings/catalog";
import type { MaskedField } from "@/lib/settings/types";

export function SecretField({
  id,
  label,
  hint,
  field,
  value,
  onChange,
  placeholder = "Nuevo valor (opcional)",
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
          Configurado {field.preview} · origen: {sourceLabel(field.source)}
        </p>
      ) : (
        <p className="mb-1 text-[11px] text-(--muted-fg)">Sin configurar</p>
      )}
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <p className="mt-1 text-[11px] text-(--muted-fg)">
        {hint ?? "Vacío = no cambiar el secreto actual."}
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
