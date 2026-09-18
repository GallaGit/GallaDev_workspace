/** Fila canónica de captación (intake_settings). */
export type IntakeSettings = {
  isOpen: boolean;
  message: string;
  /** ISO-8601 timestamptz, o null si no hay fecha de reapertura. */
  reopensAt: string | null;
  updatedAt?: string;
};

/** Payload público para la landing (CORS). */
export type IntakePublicStatus =
  | { open: true }
  | { open: false; message: string; reopensAt: string | null };

/** PATCH autenticado desde Settings. */
export type IntakeSettingsPatch = {
  isOpen?: boolean;
  message?: string;
  /** ISO-8601 o null para limpiar. */
  reopensAt?: string | null;
};
