-- Fase 1 v2.0 — Fundación Supabase: leads + activities + RLS (dev single-user).
-- Fuente de verdad de dominio: src/lib/domain/lead.ts (9 estados canónicos).
-- Mapping Notion exacto: docs/product/DECISIONES.md §3.
-- Notion sigue operando en paralelo; esta migración NO borra nada.
-- Roles finos (Admin/Vendedor/Viewer) llegan en Fase 2; aquí políticas dev permisivas
-- para rol authenticated + service_role (bypass RLS) usado por el servidor/migración.
-- Anon no recibe ninguna policy => denegado por defecto.

-- 1. Enum de estados (9 canónicos, idénticos a LEAD_STATUSES)
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'Nuevo',
    'Pendiente revisar',
    'Validado',
    'Email preparado',
    'Email enviado',
    'Respondió',
    'Reunión',
    'Cliente',
    'Descartado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabla leads
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Idempotencia con Notion (page id con guiones, tal cual lo devuelve la API).
  -- NULL para leads creados nativamente en Supabase (futuro).
  notion_page_id text UNIQUE,
  company_name text NOT NULL DEFAULT 'Sin nombre',
  website text,
  email text,
  email_commercial text,
  email_manager text,
  phone text,
  address text,
  postal_code text,
  city text,
  city_canonical text,
  province text,
  employees integer CHECK (employees IS NULL OR employees >= 0),
  linkedin text,
  services text[] NOT NULL DEFAULT '{}',
  status public.lead_status NOT NULL DEFAULT 'Nuevo',
  last_activity date,
  discovered_at timestamptz,
  notes text,
  notes_overflow text,
  email_subject text,
  email_body text,
  score double precision,
  manager text,
  role text,
  confidence text,
  software text,
  source text,
  last_contact date,
  next_follow_up date,
  favorite boolean NOT NULL DEFAULT false,
  ai_analysis text,
  url text,
  notion_last_edited_time timestamptz,
  archived boolean NOT NULL DEFAULT false,
  -- Futuro v2 (decisiones #3/#5: sin tags ni responsable en v1)
  tags text[] NOT NULL DEFAULT '{}',
  responsable uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Timeline de actividad (equivale a bloques "Actividad" de Notion)
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'event',
  message text NOT NULL DEFAULT ''
);

-- 4. updated_at automático (SECURITY INVOKER: corre con privilegios del invocador)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Índices (filtros y stats usan estos campos: filter-leads.ts, compute-stats.ts)
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_archived ON public.leads (archived);
CREATE INDEX IF NOT EXISTS idx_leads_active_status ON public.leads (status) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS idx_leads_province ON public.leads (province);
CREATE INDEX IF NOT EXISTS idx_leads_city_canonical ON public.leads (city_canonical);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_notion_page_id ON public.leads (notion_page_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_at ON public.lead_activities (lead_id, at DESC);

-- 6. RLS (obligatorio en schema expuesto `public`)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Limpieza idempotente para re-ejecución segura
DROP POLICY IF EXISTS "dev_authenticated_all_leads" ON public.leads;
DROP POLICY IF EXISTS "dev_authenticated_all_activities" ON public.lead_activities;

-- Dev single-user (AUTH_DISABLED=true en app): authenticated tiene acceso total.
-- Fase 2 lo restringirá por responsable/rol. Anon no tiene policy => bloqueado.
-- UPDATE lleva USING + WITH CHECK (sin WITH CHECK se podría reasignar filas).
CREATE POLICY "dev_authenticated_all_leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dev_authenticated_all_activities"
  ON public.lead_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. Grants Data API (sin esto, anon/authenticated no ven la tabla aunque haya policy)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT USAGE ON TYPE public.lead_status TO authenticated;
-- service_role ya tiene bypassrls; no requiere grants adicionales.
