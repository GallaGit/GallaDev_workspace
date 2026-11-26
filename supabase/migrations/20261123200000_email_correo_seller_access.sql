-- Correo: Admin y Seller leen y usan el buzón (hilos, mensajes, adjuntos y
-- borradores). La firma de cada buzón se puede leer al redactar; solo Admin
-- la crea o la edita (policies de escritura sin cambios).
--
-- Usa public.current_app_role(), igual que el resto de policies.
-- No edita migraciones anteriores. No aplicar desde el repo: ejecutar en el
-- SQL editor de Supabase ANTES de desplegar el código que depende de este
-- acceso.

-- Hilos ---------------------------------------------------------------
DROP POLICY IF EXISTS "email_threads_admin_read" ON public.email_threads;
DROP POLICY IF EXISTS "email_threads_mailbox_read" ON public.email_threads;
CREATE POLICY "email_threads_mailbox_read"
  ON public.email_threads
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Seller'));

DROP POLICY IF EXISTS "email_threads_admin_update" ON public.email_threads;
DROP POLICY IF EXISTS "email_threads_mailbox_update" ON public.email_threads;
CREATE POLICY "email_threads_mailbox_update"
  ON public.email_threads
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Seller'))
  WITH CHECK (public.current_app_role() IN ('Admin', 'Seller'));

-- Mensajes ------------------------------------------------------------
DROP POLICY IF EXISTS "email_messages_admin_read" ON public.email_messages;
DROP POLICY IF EXISTS "email_messages_mailbox_read" ON public.email_messages;
CREATE POLICY "email_messages_mailbox_read"
  ON public.email_messages
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN ('Admin', 'Seller')
    AND EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
    )
  );

-- Adjuntos (metadatos; los bytes salen por la API con el cliente admin) --
DROP POLICY IF EXISTS "email_attachments_admin_read" ON public.email_attachments;
DROP POLICY IF EXISTS "email_attachments_mailbox_read" ON public.email_attachments;
CREATE POLICY "email_attachments_mailbox_read"
  ON public.email_attachments
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN ('Admin', 'Seller')
    AND EXISTS (
      SELECT 1
      FROM public.email_messages m
      JOIN public.email_threads t ON t.id = m.thread_id
      WHERE m.id = email_attachments.message_id
    )
  );

-- Borradores ----------------------------------------------------------
DROP POLICY IF EXISTS "email_drafts_admin_select" ON public.email_drafts;
DROP POLICY IF EXISTS "email_drafts_mailbox_select" ON public.email_drafts;
CREATE POLICY "email_drafts_mailbox_select"
  ON public.email_drafts
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Seller'));

DROP POLICY IF EXISTS "email_drafts_admin_insert" ON public.email_drafts;
DROP POLICY IF EXISTS "email_drafts_mailbox_insert" ON public.email_drafts;
CREATE POLICY "email_drafts_mailbox_insert"
  ON public.email_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() IN ('Admin', 'Seller'));

DROP POLICY IF EXISTS "email_drafts_admin_update" ON public.email_drafts;
DROP POLICY IF EXISTS "email_drafts_mailbox_update" ON public.email_drafts;
CREATE POLICY "email_drafts_mailbox_update"
  ON public.email_drafts
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Seller'))
  WITH CHECK (public.current_app_role() IN ('Admin', 'Seller'));

DROP POLICY IF EXISTS "email_drafts_admin_delete" ON public.email_drafts;
DROP POLICY IF EXISTS "email_drafts_mailbox_delete" ON public.email_drafts;
CREATE POLICY "email_drafts_mailbox_delete"
  ON public.email_drafts
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Seller'));

-- Firmas: lectura para redactar; escritura solo Admin (sin cambios) ----
DROP POLICY IF EXISTS "email_mailbox_signatures_admin_select"
  ON public.email_mailbox_signatures;
DROP POLICY IF EXISTS "email_mailbox_signatures_mailbox_select"
  ON public.email_mailbox_signatures;
CREATE POLICY "email_mailbox_signatures_mailbox_select"
  ON public.email_mailbox_signatures
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Seller'));

-- Un borrador de mensaje nuevo por lead (upsert desde la ficha).
CREATE INDEX IF NOT EXISTS idx_email_drafts_lead_new
  ON public.email_drafts (lead_id)
  WHERE thread_id IS NULL AND lead_id IS NOT NULL;
