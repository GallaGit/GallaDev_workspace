export type N8nClientErrorCode =
  | "timeout"
  | "http"
  | "invalid_json"
  | "not_configured"
  | "network"
  | "unsafe_url";

export class N8nClientError extends Error {
  readonly code: N8nClientErrorCode;
  readonly status?: number;

  constructor(
    message: string,
    code: N8nClientErrorCode,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "N8nClientError";
    this.code = code;
    this.status = options?.status;
  }
}
