import type { MaskedField, SourcedString, ValueSource } from "./types";

export function maskSecret(value: string, source: ValueSource): MaskedField {
  const trimmed = value.trim();
  if (!trimmed) {
    return { configured: false, preview: null, source: "none" };
  }
  const last4 = trimmed.slice(-4);
  return { configured: true, preview: `••••${last4}`, source };
}

export function maskSourcedSecret(field: SourcedString): MaskedField {
  return maskSecret(field.value, field.source);
}
