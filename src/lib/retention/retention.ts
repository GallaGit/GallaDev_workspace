import { timingSafeEqual } from "node:crypto";

/**
 * Retención de datos personales: lógica compartida entre la ruta del cron
 * (/api/cron/retention) y sus tests. El purgado real vive en la función SQL
 * `public.purge_expired_personal_data` (supabase/migrations/*_data_retention.sql);
 * aquí solo se autentica el cron, se invoca el RPC y se limpia Storage.
 */

export type RetentionResult = {
  dry_run: boolean;
  leads: number;
  clients: number;
  activities: number;
  email_threads: number;
  email_messages: number;
  email_attachments: number;
  email_drafts: number;
  storage_paths: string[];
};

export type RetentionClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  storage?: {
    from: (bucket: string) => {
      remove: (paths: string[]) => PromiseLike<{ error: unknown }>;
    };
  };
};

/** Cabecera exacta `Bearer <secret>` del cron de Vercel. */
const CRON_MIN_SECRET_LENGTH = 16;
const STORAGE_CHUNK_SIZE = 100;

export function isAuthorizedCronRequest(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < CRON_MIN_SECRET_LENGTH) return false;
  if (!authHeader) return false;

  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const provided = Buffer.from(authHeader, "utf8");
  // timingSafeEqual lanza con longitudes distintas: se descarta antes.
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function parseRetentionResult(data: unknown): RetentionResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("invalid_retention_result");
  }
  const raw = data as Record<string, unknown>;

  if (typeof raw.dry_run !== "boolean") {
    throw new Error("invalid_retention_result");
  }

  const counts = [
    "leads",
    "clients",
    "activities",
    "email_threads",
    "email_messages",
    "email_attachments",
    "email_drafts",
  ] as const;
  for (const key of counts) {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error("invalid_retention_result");
    }
  }

  const paths = raw.storage_paths;
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === "string")) {
    throw new Error("invalid_retention_result");
  }

  return {
    dry_run: raw.dry_run,
    leads: raw.leads as number,
    clients: raw.clients as number,
    activities: raw.activities as number,
    email_threads: raw.email_threads as number,
    email_messages: raw.email_messages as number,
    email_attachments: raw.email_attachments as number,
    email_drafts: raw.email_drafts as number,
    storage_paths: paths as string[],
  };
}

/** Línea única para logs: recuentos y nº de ficheros, nunca las rutas. */
export function formatRetentionLog(r: RetentionResult): string {
  return (
    `[retention] dry_run=${r.dry_run} leads=${r.leads} clients=${r.clients}` +
    ` activities=${r.activities} email_threads=${r.email_threads}` +
    ` email_messages=${r.email_messages} email_attachments=${r.email_attachments}` +
    ` email_drafts=${r.email_drafts} storage_files=${r.storage_paths.length}`
  );
}

export async function runRetention(
  client: RetentionClient,
  opts: { dryRun: boolean; bucket?: string },
): Promise<RetentionResult & { storage_removed: number }> {
  const { data, error } = await client.rpc("purge_expired_personal_data", {
    dry_run: opts.dryRun,
  });
  if (error) throw new Error(error.message);

  const parsed = parseRetentionResult(data);

  let storageRemoved = 0;
  const bucket = opts.bucket;
  if (!opts.dryRun && bucket && parsed.storage_paths.length > 0 && client.storage) {
    for (let i = 0; i < parsed.storage_paths.length; i += STORAGE_CHUNK_SIZE) {
      const chunk = parsed.storage_paths.slice(i, i + STORAGE_CHUNK_SIZE);
      const { error: removeError } = await client.storage.from(bucket).remove(chunk);
      if (removeError) throw new Error("storage_remove_failed");
      storageRemoved += chunk.length;
    }
  }

  return { ...parsed, storage_removed: storageRemoved };
}
