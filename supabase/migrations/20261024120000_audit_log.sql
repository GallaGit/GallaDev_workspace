-- Audit log para trazabilidad de acciones críticas.
--
-- actor_id se desvincula si se elimina el usuario (ON DELETE SET NULL).
-- diff guarda el "antes/después" o el cambio aplicado; se permite vacío por defecto.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create','update','delete','role_change')),
  entity text NOT NULL,
  entity_id text NOT NULL,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_entity_id_idx ON public.audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_desc_idx ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_log FROM anon;

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
-- authenticated no puede actualizar ni borrar entradas de auditoría.

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() = 'Admin');
