-- Audit trail, primera entrega: solidez, detalle y visibilidad.
--
-- 1. Solo el servidor (service_role) escribe: se revoca INSERT a anon y
--    authenticated y se elimina la policy de insert. Nadie de la app
--    puede UPDATE ni DELETE (append-only).
-- 2. Columnas actor_email, actor_role y lead_id.
-- 3. action pasa a nombres con punto (`lead.status_changed`, `auth.login`...).
--    Se sustituye el CHECK cerrado por uno de formato; los valores antiguos
--    (create, update, delete, role_change) siguen siendo válidos.
-- 4. RLS de lectura: Admin todo; Seller y Viewer solo eventos de leads que
--    pueden ver (misma regla que public.leads, aplicada por su RLS).

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS lead_id uuid;

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_role_check;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_role_check
  CHECK (actor_role IS NULL OR actor_role IN ('Admin','Seller','Viewer'));

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_action_check
  CHECK (action ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)?$' AND length(action) <= 64);

-- Eventos antiguos de leads: enlazar por entity_id cuando es un uuid válido.
UPDATE public.audit_log
SET lead_id = entity_id::uuid
WHERE entity = 'lead'
  AND lead_id IS NULL
  AND entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE INDEX IF NOT EXISTS audit_log_lead_id_created_at_idx
  ON public.audit_log (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_actor_id_created_at_idx
  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_created_at_idx
  ON public.audit_log (action, created_at DESC);

-- Escritura solo desde servidor.
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
REVOKE ALL ON public.audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM service_role;

-- Lectura.
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() = 'Admin');

-- El EXISTS se evalúa con el RLS de public.leads del usuario que consulta:
-- Seller solo ve eventos de leads propios; Viewer ve los de todos los leads.
DROP POLICY IF EXISTS "audit_log_select_lead_visible" ON public.audit_log;
CREATE POLICY "audit_log_select_lead_visible"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    lead_id IS NOT NULL
    AND public.current_app_role() IN ('Seller', 'Viewer')
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = audit_log.lead_id)
  );
