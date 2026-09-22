-- Paso 2.0 (slice SaaS): auto-perfil al crear usuarios.
--
-- Altas cerradas (decisión 2026-09-22): el Admin crea las cuentas en
-- Dashboard → Authentication → Users. Este trigger les asigna perfil
-- automáticamente con el rol por defecto Seller (equipo interno).
-- El primer Admin se marca a mano tras crear su usuario:
--   UPDATE public.profiles SET role = 'Admin' WHERE id = '<auth.users.id>';
--
-- Requiere la migración 20260922000000_roles_rls.sql (tabla profiles,
-- enum app_role). Aplicar en dashboard tras esa.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'Seller')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
