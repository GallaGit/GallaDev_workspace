  -- M1 recortado (GEM_ROADMAP 1.2): roles por usuario + RLS restrictiva.
--
-- La app accede vía service_role (bypass RLS) y NO se ve afectada.
-- El acceso directo a PostgREST con clave authenticated queda restringido:
--   - Admin: lectura/escritura total.
--   - Seller: solo leads propios (responsable = auth.uid()) o sin asignar.
--   - Viewer: solo lectura.
--   - authenticated sin perfil: denegado por defecto.
--
-- La identidad por usuario (Supabase Auth JWT) y la asignación de
-- responsable llegan en el Paso 2 (slice SaaS). Esta migración deja el
-- esquema y las policies listos y cierra el agujero "authenticated lee todo".
-- Alta del primer Admin (tras crear el usuario en Supabase Auth):
--   INSERT INTO public.profiles (id, role) VALUES ('<auth.users.id>', 'Admin');

-- 1. Roles de la app
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('Admin', 'Seller', 'Viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Perfiles 1:1 con auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'Viewer',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY "profiles_self_read"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
-- Sin policies de escritura para authenticated: los perfiles se gestionan
-- vía service_role (servidor). Nadie puede auto-elevarse a Admin.

GRANT SELECT ON public.profiles TO authenticated;
GRANT USAGE ON TYPE public.app_role TO authenticated;

-- 3. Helper: rol del invocador (SECURITY DEFINER para no recursar en RLS)
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

-- 4. Sustituir policies dev permisivas (USING(true)) por policies por rol
DROP POLICY IF EXISTS "dev_authenticated_all_leads" ON public.leads;
DROP POLICY IF EXISTS "dev_authenticated_all_activities" ON public.lead_activities;

-- 4a. leads: lectura
DROP POLICY IF EXISTS "role_leads_select" ON public.leads;
CREATE POLICY "role_leads_select"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    OR public.current_app_role() = 'Viewer'
    OR (
      public.current_app_role() = 'Seller'
      AND (responsable IS NULL OR responsable = auth.uid())
    )
  );

-- 4b. leads: creación (Admin o Seller asignándose a sí mismo / sin asignar)
DROP POLICY IF EXISTS "role_leads_insert" ON public.leads;
CREATE POLICY "role_leads_insert"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND (responsable IS NULL OR responsable = auth.uid())
    )
  );

-- 4c. leads: actualización (misma regla en USING y WITH CHECK para no
-- poder reasignar filas fuera del propio alcance)
DROP POLICY IF EXISTS "role_leads_update" ON public.leads;
CREATE POLICY "role_leads_update"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND (responsable IS NULL OR responsable = auth.uid())
    )
  )
  WITH CHECK (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND (responsable IS NULL OR responsable = auth.uid())
    )
  );

-- 4d. leads: borrado solo Admin (la app archiva, no borra)
DROP POLICY IF EXISTS "role_leads_delete" ON public.leads;
CREATE POLICY "role_leads_delete"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'Admin');

-- 4e. lead_activities: heredan la visibilidad del lead padre
DROP POLICY IF EXISTS "role_activities_select" ON public.lead_activities;
CREATE POLICY "role_activities_select"
  ON public.lead_activities
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    OR public.current_app_role() = 'Viewer'
    OR (
      public.current_app_role() = 'Seller'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_activities.lead_id
          AND (l.responsable IS NULL OR l.responsable = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "role_activities_insert" ON public.lead_activities;
CREATE POLICY "role_activities_insert"
  ON public.lead_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_activities.lead_id
          AND (l.responsable IS NULL OR l.responsable = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "role_activities_update" ON public.lead_activities;
CREATE POLICY "role_activities_update"
  ON public.lead_activities
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_activities.lead_id
          AND (l.responsable IS NULL OR l.responsable = auth.uid())
      )
    )
  )
  WITH CHECK (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_activities.lead_id
          AND (l.responsable IS NULL OR l.responsable = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "role_activities_delete" ON public.lead_activities;
CREATE POLICY "role_activities_delete"
  ON public.lead_activities
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'Admin');

-- 5. Grants (las policies restringen; sin grants ni siquiera Admin pasaría).
-- profiles queda solo con el GRANT SELECT de §2: sin policies de escritura,
-- authenticated no puede crear ni modificar perfiles aunque tenga rol.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
