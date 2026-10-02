-- SEC-014: handle_new_user no es una RPC.
--
-- El trigger on_auth_user_created la ejecuta como dueño de la función.
-- Fuera del trigger, NEW es nulo. PUBLIC conserva EXECUTE en funciones
-- nuevas de public salvo que se revoque (igual que current_app_role y
-- bump_session_epoch).
--
-- Aplicar en el SQL editor de Supabase después de las migraciones
-- anteriores. No edita migraciones viejas. No toca filas.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
