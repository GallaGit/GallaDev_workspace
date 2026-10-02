import type { MaskedField, SourcedString, ValueSource } from "./types";

export function maskSecret(value: string, source: ValueSource): MaskedField {
  const trimmed = value.trim();
  if (!trimmed) {
    return { configured: false, preview: null, source: "none" };
  }
  const last4 = trimmed.slice(-4);
  return { configured: true, preview: `••••${last4}`, source };
}

export function maskUrl(value: string, source: ValueSource): MaskedField {
  const trimmed = value.trim();
  if (!trimmed) {
    return { configured: false, preview: null, source: "none" };
  }
  try {
    const url = new URL(trimmed);
    const tail = (url.pathname + url.search).slice(-4) || trimmed.slice(-4);
    return {
      configured: true,
      preview: `${url.origin}/••••${tail}`,
      source,
    };
  } catch {
    return maskSecret(trimmed, source);
  }
}

export function maskSourcedSecret(field: SourcedString): MaskedField {
  return maskSecret(field.value, field.source);
}

export function maskSourcedUrl(field: SourcedString): MaskedField {
  return maskUrl(field.value, field.source);
}

/** Oculta el host. La preview no sirve para reconstruir la URL base. */
export function maskEndpoint(value: string, source: ValueSource): MaskedField {
  const trimmed = value.trim();
  if (!trimmed) {
    return { configured: false, preview: null, source: "none" };
  }
  try {
    const url = new URL(trimmed);
    const tail = url.hostname.slice(-4);
    return {
      configured: true,
      preview: `${url.protocol}//••••${tail}`,
      source,
    };
  } catch {
    return maskSecret(trimmed, source);
  }
}

export function maskSourcedEndpoint(field: SourcedString): MaskedField {
  return maskEndpoint(field.value, field.source);
}
