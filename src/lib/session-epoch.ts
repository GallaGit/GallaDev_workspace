/**
 * Session epoch (sv) for global logout ("cerrar todas las sesiones").
 *
 * - Default from `data/session-epoch.json` (bundled via JSON import).
 * - `SESSION_EPOCH` env overrides (Vercel / multi-instance durability).
 * - Cookie payload carries `sv`; mismatch → reject. Sliding refresh keeps
 *   the current epoch (does not bump).
 *
 * This module must stay Edge-compatible (middleware imports it via auth-session).
 * File writes happen only inside `bumpSessionEpoch` via dynamic require.
 */

import epochFile from "../../data/session-epoch.json";

const BUNDLED_SV =
  typeof (epochFile as { sv?: unknown }).sv === "number"
    ? Math.floor((epochFile as { sv: number }).sv)
    : 1;

function parseEpoch(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Current session epoch (env → bundled default). */
export function getSessionEpoch(): number {
  const fromEnv = parseEpoch(process.env.SESSION_EPOCH);
  if (fromEnv !== null) return fromEnv;
  return BUNDLED_SV;
}

/**
 * Bump epoch (logout-all). Sets `process.env.SESSION_EPOCH` for this isolate
 * and best-effort writes `data/session-epoch.json` (Node only).
 * On Vercel multi-instance, set `SESSION_EPOCH` in project env so every
 * Edge/Node isolate agrees.
 */
export function bumpSessionEpoch(): number {
  const next = getSessionEpoch() + 1;
  process.env.SESSION_EPOCH = String(next);
  try {
    // Dynamic require keeps the Edge bundle free of node:fs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const p = path.join(process.cwd(), "data", "session-epoch.json");
    fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
    fs.writeFileSync(p, `${JSON.stringify({ sv: next }, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch (error) {
    console.warn("[session-epoch] no se pudo escribir data/session-epoch.json", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
  return next;
}
