import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldAutoOpen } from "./status";
import type { IntakeSettings, IntakeSettingsPatch } from "./types";

const ROW_ID = 1;

const DEFAULT_SETTINGS: IntakeSettings = {
  isOpen: true,
  message: "La captación está pausada. Reabrimos el {fecha}.",
  reopensAt: null,
};

type DbRow = {
  id: number;
  is_open: boolean;
  message: string;
  reopens_at: string | null;
  updated_at: string;
};

function mapRow(row: DbRow): IntakeSettings {
  return {
    isOpen: Boolean(row.is_open),
    message: row.message ?? "",
    reopensAt: row.reopens_at ?? null,
    updatedAt: row.updated_at,
  };
}

/**
 * Lee captación desde Supabase (service_role).
 * Si el countdown ya pasó y sigue marcada cerrada, persiste auto-apertura.
 */
export async function getIntakeSettings(): Promise<IntakeSettings> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("intake_settings")
    .select("id, is_open, message, reopens_at, updated_at")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`intake_settings: ${error.message}`);
  }

  if (!data) {
    // Fila ausente (migración no aplicada): sembrar defaults abiertos.
    const { data: inserted, error: insertError } = await admin
      .from("intake_settings")
      .upsert({
        id: ROW_ID,
        is_open: DEFAULT_SETTINGS.isOpen,
        message: DEFAULT_SETTINGS.message,
        reopens_at: null,
      })
      .select("id, is_open, message, reopens_at, updated_at")
      .single();
    if (insertError || !inserted) {
      throw new Error(
        `intake_settings seed: ${insertError?.message ?? "sin fila"}`,
      );
    }
    return mapRow(inserted as DbRow);
  }

  const settings = mapRow(data as DbRow);
  if (shouldAutoOpen(settings)) {
    // Lazy persist: marca abierta y limpia la fecha ya vencida.
    return patchIntakeSettings({ isOpen: true, reopensAt: null });
  }
  return settings;
}

export async function patchIntakeSettings(
  patch: IntakeSettingsPatch,
): Promise<IntakeSettings> {
  const admin = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};
  if (typeof patch.isOpen === "boolean") update.is_open = patch.isOpen;
  if (typeof patch.message === "string") update.message = patch.message;
  if (patch.reopensAt !== undefined) {
    if (patch.reopensAt === null || patch.reopensAt === "") {
      update.reopens_at = null;
    } else {
      const d = new Date(patch.reopensAt);
      if (Number.isNaN(d.getTime())) {
        throw new Error("reopensAt no es una fecha válida");
      }
      update.reopens_at = d.toISOString();
    }
  }

  if (Object.keys(update).length === 0) {
    return getIntakeSettings();
  }

  const { data, error } = await admin
    .from("intake_settings")
    .upsert({ id: ROW_ID, ...update }, { onConflict: "id" })
    .select("id, is_open, message, reopens_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`intake_settings patch: ${error?.message ?? "sin fila"}`);
  }
  return mapRow(data as DbRow);
}

export function validateIntakePatch(
  patch: IntakeSettingsPatch,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (patch.isOpen !== undefined && typeof patch.isOpen !== "boolean") {
    errors.isOpen = "Debe ser true o false";
  }
  if (patch.message !== undefined) {
    if (typeof patch.message !== "string") {
      errors.message = "Mensaje inválido";
    } else if (patch.message.length > 2000) {
      errors.message = "Máximo 2000 caracteres";
    }
  }
  if (patch.reopensAt !== undefined && patch.reopensAt !== null) {
    if (typeof patch.reopensAt !== "string") {
      errors.reopensAt = "Fecha inválida";
    } else if (patch.reopensAt !== "" && Number.isNaN(new Date(patch.reopensAt).getTime())) {
      errors.reopensAt = "Fecha inválida";
    }
  }
  return errors;
}
