-- SEC-002 / SEC-003: alta sin rol y leads sin responsable solo para Admin.
--
-- No modifica filas existentes de profiles. Las cuentas que ya tienen
-- Admin, Seller o Viewer siguen igual.
--
-- Alta nueva: el trigger inserta profiles.role NULL (pendiente). No lee
-- raw_user_meta_data: un alta pública podría pedir un rol privilegiado.
-- Un Admin asigna el rol después (Settings → Equipo, service_role).
-- Mantener el registro público desactivado en el dashboard de Auth.
--
-- Leads: Seller solo si responsable = auth.uid(). No ve ni edita la cola
-- sin responsable, y no puede poner responsable a NULL ni a otra persona.
-- Admin sí: lee, edita y asigna esa cola.
-- Viewer sigue leyendo leads y actividades (rol de solo lectura de toda
-- la cartera, un solo equipo). No hay rol manager. Viewer no escribe.
--
-- Aplicar en el SQL editor de Supabase después de las migraciones
-- anteriores. No edita migraciones viejas.

ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- leads
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
      AND responsable = auth.uid()
    )
  );

DROP POLICY IF EXISTS "role_leads_insert" ON public.leads;
CREATE POLICY "role_leads_insert"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND responsable = auth.uid()
    )
  );

DROP POLICY IF EXISTS "role_leads_update" ON public.leads;
CREATE POLICY "role_leads_update"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND responsable = auth.uid()
    )
  )
  WITH CHECK (
    public.current_app_role() = 'Admin'
    OR (
      public.current_app_role() = 'Seller'
      AND responsable = auth.uid()
    )
  );

-- lead_activities: misma visibilidad que el lead padre
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
          AND l.responsable = auth.uid()
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
          AND l.responsable = auth.uid()
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
          AND l.responsable = auth.uid()
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
          AND l.responsable = auth.uid()
      )
    )
  );
