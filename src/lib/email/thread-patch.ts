import { isUuid } from "@/lib/supabase/lead-lookup";

export type ThreadPatch = {
  is_read?: boolean;
  lead_id?: string | null;
};

export type ThreadPatchResult =
  | { ok: true; patch: ThreadPatch }
  | { ok: false; error: string };

export function threadUpdateFromBody(
  body: Record<string, unknown>,
): ThreadPatchResult {
  const patch: ThreadPatch = {};
  if (typeof body.is_read === "boolean") patch.is_read = body.is_read;
  if ("lead_id" in body) {
    if (body.lead_id === null) {
      patch.lead_id = null;
    } else if (typeof body.lead_id === "string" && isUuid(body.lead_id)) {
      patch.lead_id = body.lead_id;
    } else {
      return { ok: false, error: "lead_id no es un UUID" };
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada que actualizar" };
  }
  return { ok: true, patch };
}
