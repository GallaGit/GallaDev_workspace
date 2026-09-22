-- M1 recortado: endurecer EXECUTE en funciones SECURITY DEFINER públicas.
--
-- Detectado por Supabase security advisors (0028/0029). Solo authenticated
-- debe ejecutar current_app_role(); rls_auto_enable() no es API pública.

-- current_app_role: la usan las policies RLS; authenticated sí la necesita.
-- Anon y PUBLIC no deben poder invocarla vía /rest/v1/rpc/current_app_role.
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

-- rls_auto_enable: no es función de la app; nadie externo debe ejecutarla.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
