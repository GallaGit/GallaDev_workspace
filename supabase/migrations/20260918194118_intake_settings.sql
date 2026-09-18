-- Captación (intake) durable: open/paused + mensaje + reopens_at.
-- Single-row (id=1). Persistido en Supabase (no settings.local.json / Vercel ephemeral).
-- Anon: sin policies => denegado. El servidor usa service_role (bypass RLS).

CREATE TABLE IF NOT EXISTS public.intake_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_open boolean NOT NULL DEFAULT true,
  message text NOT NULL DEFAULT '',
  reopens_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_intake_settings_updated_at ON public.intake_settings;
CREATE TRIGGER trg_intake_settings_updated_at
  BEFORE UPDATE ON public.intake_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.intake_settings (id, is_open, message, reopens_at)
VALUES (
  1,
  true,
  'La captación está pausada. Reabrimos el {fecha}.',
  NULL
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.intake_settings ENABLE ROW LEVEL SECURITY;

-- Sin policies para anon. authenticated puede leer/actualizar (Settings vía cookie
-- de app usa service_role; esto deja margen si un día el cliente Supabase Auth lee).
DROP POLICY IF EXISTS "dev_authenticated_all_intake_settings" ON public.intake_settings;
CREATE POLICY "dev_authenticated_all_intake_settings"
  ON public.intake_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.intake_settings TO authenticated;
