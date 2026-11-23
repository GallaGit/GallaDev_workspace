import {
  COMPANY_MAILBOXES,
  isCompanyMailbox,
  type CompanyMailbox,
} from "./mailboxes";
import type { ThreadView } from "./thread-state";

/**
 * Rutas del módulo /correo (punto 7). Una URL por carpeta, con slugs en
 * español, y la cuenta (buzón) como query `?cuenta=`. Lógica pura: la usan
 * las páginas (redirecciones), el proxy y la UI.
 */

export const CORREO_BASE = "/correo";

export const CORREO_FOLDERS = [
  "inbox",
  "sent",
  "archived",
  "trash",
  "drafts",
] as const;
export type CorreoFolder = (typeof CORREO_FOLDERS)[number];

export const DEFAULT_CORREO_FOLDER: CorreoFolder = "inbox";

export const FOLDER_SLUGS: Record<CorreoFolder, string> = {
  inbox: "recibidos",
  sent: "enviados",
  archived: "archivados",
  trash: "papelera",
  drafts: "borradores",
};

/** Alias de entrada (inglés y variantes) que redirigen a la carpeta real. */
const FOLDER_ALIASES: Record<string, CorreoFolder> = {
  inbox: "inbox",
  recibido: "inbox",
  entrada: "inbox",
  sent: "sent",
  enviado: "sent",
  archived: "archived",
  archive: "archived",
  archivado: "archived",
  trash: "trash",
  bin: "trash",
  papelera: "trash",
  drafts: "drafts",
  draft: "drafts",
  borrador: "drafts",
};

export type MailListView = ThreadView;

export function folderToSlug(folder: CorreoFolder): string {
  return FOLDER_SLUGS[folder];
}

/** Carpeta exacta de un slug canónico; null si no existe. */
export function folderFromSlug(slug: string | null | undefined): CorreoFolder | null {
  const value = (slug ?? "").trim().toLowerCase();
  const found = CORREO_FOLDERS.find((folder) => FOLDER_SLUGS[folder] === value);
  return found ?? null;
}

/** Carpeta equivalente de un slug no canónico; Recibidos si no hay. */
export function resolveFolderAlias(slug: string | null | undefined): CorreoFolder {
  const value = (slug ?? "").trim().toLowerCase();
  return folderFromSlug(value) ?? FOLDER_ALIASES[value] ?? DEFAULT_CORREO_FOLDER;
}

/** Vista de hilos (API `view`) de una carpeta; Borradores no tiene. */
export function folderThreadView(folder: CorreoFolder): MailListView | null {
  return folder === "drafts" ? null : folder;
}

export type AccountFilter = "all" | CompanyMailbox;

/** `?cuenta=hola` → buzón. Vacío, `todas` o un valor desconocido → todas. */
export function parseAccountParam(raw: string | null | undefined): AccountFilter {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value === "todas") return "all";
  const mailbox = COMPANY_MAILBOXES.find(
    (m) => m.split("@")[0] === value || m === value,
  );
  return mailbox ?? "all";
}

/** Valor de `?cuenta=` para un buzón (local-part); null = omitir. */
export function accountToParam(account: AccountFilter): string | null {
  if (account === "all" || !isCompanyMailbox(account)) return null;
  return account.split("@")[0] ?? null;
}

export function accountLabel(account: CompanyMailbox): string {
  return `${account.split("@")[0]}@`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isThreadId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function correoPath(
  folder: CorreoFolder,
  threadId?: string | null,
  account: AccountFilter = "all",
): string {
  const base = `${CORREO_BASE}/${folderToSlug(folder)}`;
  const path =
    threadId && folder !== "drafts" && isThreadId(threadId)
      ? `${base}/${threadId}`
      : base;
  const cuenta = accountToParam(account);
  return cuenta ? `${path}?cuenta=${encodeURIComponent(cuenta)}` : path;
}

export function isCorreoPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === CORREO_BASE || pathname.startsWith(`${CORREO_BASE}/`);
}

export type ParsedCorreoPath = {
  folder: CorreoFolder;
  threadId: string | null;
};

/**
 * Carpeta e hilo de una URL /correo/{slug}[/{threadId}]. Una ruta que no es
 * una carpeta conocida cae en Recibidos; un id que no es UUID se ignora.
 */
export function parseCorreoPath(pathname: string | null | undefined): ParsedCorreoPath {
  const segments = (pathname ?? "")
    .split("/")
    .filter(Boolean)
    .slice(1);
  const folder = folderFromSlug(segments[0]) ?? DEFAULT_CORREO_FOLDER;
  const candidate = segments[1];
  const threadId =
    folder !== "drafts" && isThreadId(candidate) ? candidate : null;
  return { folder, threadId };
}
