import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatRetentionLog,
  isAuthorizedCronRequest,
  parseRetentionResult,
  runRetention,
  type RetentionClient,
  type RetentionResult,
} from "@/lib/retention/retention";

/**
 * Contratos de la lógica de retención: auth del cron por CRON_SECRET,
 * validación del JSON del RPC, log sin rutas y purgado de Storage por chunks.
 */

const SECRET = "retention-secret-0123456789";

const VALID: RetentionResult = {
  dry_run: true,
  leads: 2,
  clients: 1,
  activities: 5,
  email_threads: 3,
  email_messages: 7,
  email_attachments: 4,
  email_drafts: 1,
  storage_paths: ["mail/2024/a.pdf", "mail/2024/b.pdf"],
};

function paths(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `mail/${i}.bin`);
}

type RpcResponse = { data: unknown; error: { message: string } | null };

function fixture(result: RetentionResult) {
  const remove = vi.fn<(paths: string[]) => Promise<{ error: unknown }>>(
    async () => ({ error: null }),
  );
  const from = vi.fn<(bucket: string) => { remove: typeof remove }>(() => ({ remove }));
  const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<RpcResponse>>(
    async () => ({ data: result as unknown, error: null }),
  );
  const client: RetentionClient = { rpc, storage: { from } };
  return { client, rpc, from, remove };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("isAuthorizedCronRequest", () => {
  it("false sin secreto o con secreto vacío", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, "")).toBe(false);
  });

  it("false con secreto más corto de 16 caracteres", () => {
    const short = "corto-123456789";
    expect(short.length).toBeLessThan(16);
    expect(isAuthorizedCronRequest(`Bearer ${short}`, short)).toBe(false);
  });

  it("false con cabecera incorrecta o ausente", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${"x".repeat(SECRET.length)}`, SECRET)).toBe(
      false,
    );
    // Sin el prefijo Bearer la longitud ya no cuadra.
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET} `, SECRET)).toBe(false);
  });

  it("true con la cabecera exacta", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });
});

describe("parseRetentionResult", () => {
  it("acepta un resultado válido", () => {
    expect(parseRetentionResult({ ...VALID })).toEqual(VALID);
  });

  it("rechaza primitivos y objetos incompletos", () => {
    expect(() => parseRetentionResult(null)).toThrow("invalid_retention_result");
    expect(() => parseRetentionResult("[]")).toThrow("invalid_retention_result");
    expect(() => parseRetentionResult({ leads: 1 })).toThrow("invalid_retention_result");
  });

  it.each([
    { leads: -1 },
    { leads: 1.5 },
    { leads: "2" },
    { email_threads: NaN },
    { email_drafts: Infinity },
  ])("rechaza el resultado %j con contadores inválidos", (patch) => {
    expect(() => parseRetentionResult({ ...VALID, ...patch })).toThrow(
      "invalid_retention_result",
    );
  });

  it("rechaza storage_paths que no sea un array de strings", () => {
    expect(() => parseRetentionResult({ ...VALID, storage_paths: "mail/a.pdf" })).toThrow(
      "invalid_retention_result",
    );
    expect(() => parseRetentionResult({ ...VALID, storage_paths: [1, 2] })).toThrow(
      "invalid_retention_result",
    );
    expect(() => parseRetentionResult({ ...VALID, storage_paths: undefined })).toThrow(
      "invalid_retention_result",
    );
    expect(() => parseRetentionResult({ ...VALID, dry_run: "true" })).toThrow(
      "invalid_retention_result",
    );
  });
});

describe("formatRetentionLog", () => {
  it("resume recuentos sin incluir ninguna ruta", () => {
    const log = formatRetentionLog(VALID);
    expect(log).toBe(
      "[retention] dry_run=true leads=2 clients=1 activities=5 email_threads=3" +
        " email_messages=7 email_attachments=4 email_drafts=1 storage_files=2",
    );
    expect(log).not.toContain("mail/2024/a.pdf");
    expect(log).not.toContain("mail/2024");
  });

  it("refleja dry_run=false", () => {
    expect(formatRetentionLog({ ...VALID, dry_run: false })).toContain(
      "dry_run=false leads=2",
    );
  });
});

describe("runRetention", () => {
  it("dry-run: llama al RPC y no toca Storage", async () => {
    const { client, rpc, from, remove } = fixture(VALID);

    const result = await runRetention(client, { dryRun: true, bucket: "attachments" });

    expect(rpc).toHaveBeenCalledWith("purge_expired_personal_data", { dry_run: true });
    expect(from).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(result.storage_removed).toBe(0);
    expect(result.storage_paths).toEqual(VALID.storage_paths);
  });

  it("ejecución real: borra Storage en chunks de 100", async () => {
    const all = paths(250);
    const { client, rpc, from, remove } = fixture({
      ...VALID,
      dry_run: false,
      storage_paths: all,
    });

    const result = await runRetention(client, { dryRun: false, bucket: "attachments" });

    expect(rpc).toHaveBeenCalledWith("purge_expired_personal_data", { dry_run: false });
    expect(from).toHaveBeenCalledWith("attachments");
    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 50]);
    expect(remove.mock.calls[0][0][0]).toBe(all[0]);
    expect(result.storage_removed).toBe(250);
  });

  it("ejecución real sin bucket configurado no toca Storage", async () => {
    const { client, from } = fixture({ ...VALID, dry_run: false });

    const result = await runRetention(client, { dryRun: false });

    expect(from).not.toHaveBeenCalled();
    expect(result.storage_removed).toBe(0);
  });

  it("lanza el mensaje del error del RPC", async () => {
    const { client, rpc } = fixture(VALID);
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    await expect(runRetention(client, { dryRun: true })).rejects.toThrow(
      "permission denied",
    );
  });

  it("lanza si el resultado del RPC no es válido", async () => {
    const { client, rpc } = fixture(VALID);
    rpc.mockResolvedValue({ data: { leads: -3 }, error: null });

    await expect(runRetention(client, { dryRun: true })).rejects.toThrow(
      "invalid_retention_result",
    );
  });
});
