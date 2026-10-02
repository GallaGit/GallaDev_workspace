-- SEC-012: el rol Admin se repite en mensajes y adjuntos.
-- Un SELECT de email_threads más abierto no abre body_html por sí solo.
--
-- FORCE ROW LEVEL SECURITY: el propietario de la tabla también pasa por
-- las policies. service_role sigue con BYPASSRLS (webhook, compose, reply).
-- No edita migraciones anteriores. No aplicar en producción desde el repo;
-- ejecutar en el SQL editor cuando se despliegue.

DROP POLICY IF EXISTS "email_messages_admin_read" ON public.email_messages;
CREATE POLICY "email_messages_admin_read"
  ON public.email_messages
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    AND EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
    )
  );

DROP POLICY IF EXISTS "email_attachments_admin_read" ON public.email_attachments;
CREATE POLICY "email_attachments_admin_read"
  ON public.email_attachments
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'Admin'
    AND EXISTS (
      SELECT 1
      FROM public.email_messages m
      JOIN public.email_threads t ON t.id = m.thread_id
      WHERE m.id = email_attachments.message_id
    )
  );

ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts FORCE ROW LEVEL SECURITY;
