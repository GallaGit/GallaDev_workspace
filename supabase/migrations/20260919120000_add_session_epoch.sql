-- Shared session version used to invalidate all application sessions.
CREATE TABLE IF NOT EXISTS public.app_session_epoch (
  id text PRIMARY KEY,
  epoch bigint NOT NULL DEFAULT 1 CHECK (epoch >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_session_epoch (id, epoch)
VALUES ('singleton', 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_session_epoch ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "session_epoch_read" ON public.app_session_epoch;
CREATE POLICY "session_epoch_read"
  ON public.app_session_epoch FOR SELECT TO anon, authenticated
  USING (id = 'singleton');

GRANT SELECT ON public.app_session_epoch TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bump_session_epoch()
RETURNS bigint LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
  UPDATE public.app_session_epoch
  SET epoch = epoch + 1, updated_at = now()
  WHERE id = 'singleton'
  RETURNING epoch;
$$;

REVOKE ALL ON FUNCTION public.bump_session_epoch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_session_epoch() TO service_role;
