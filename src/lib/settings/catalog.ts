import type { ValueSource } from "./types";

export function sourceLabel(source: ValueSource): string {
  switch (source) {
    case "file":
      return "archivo local";
    case "env":
      return ".env";
    case "default":
      return "valor por defecto";
    default:
      return "sin configurar";
  }
}

export const DEFAULT_AI_PROVIDER = "groq";
export const DEFAULT_AI_MODEL = "openai/gpt-oss-120b";
