import { parseThreadPatch, type ThreadPatch, type ThreadPatchResult } from "./email-payload";

export type { ThreadPatch, ThreadPatchResult };

/** PATCH de hilo: `is_read` booleano y `lead_id` UUID o null. */
export function threadUpdateFromBody(body: unknown): ThreadPatchResult {
  return parseThreadPatch(body);
}
