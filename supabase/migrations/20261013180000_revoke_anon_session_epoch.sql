-- GDW-SEC-021: la app no lee app_session_epoch (el logout global usa
-- supabase.auth.signOut({ scope: "global" })), así que anon no necesita verla.
-- Se mantiene la lectura para authenticated y la función bump solo para service_role.
-- Aplicar manualmente en el SQL editor de Supabase.

REVOKE ALL ON public.app_session_epoch FROM anon;

DROP POLICY IF EXISTS "session_epoch_read" ON public.app_session_epoch;
CREATE POLICY "session_epoch_read"
  ON public.app_session_epoch FOR SELECT TO authenticated
  USING (id = 'singleton');
