-- Correo, mejora 5 (Nuevo mensaje): Cc/Cco en borradores y firma por buzón.
--
-- 1. email_drafts.cc_address / bcc_address (texto libre, como to_address).
--    Los borradores de mensaje nuevo guardan Cc y Cco al autoguardar.
--    Los correos enviados ya guardan Cc/Cco en email_messages.cc_addresses /
--    bcc_addresses (columnas que existen desde email_inbox), sin cambios ahí.
--
-- 2. email_mailbox_signatures: una firma de texto por buzón (hola@ / ociel@),
--    editable por Admin en Ajustes. Se añade al cuerpo al redactar.
--
-- RLS: solo Admin lee y escribe, igual que email_drafts. FORCE ROW LEVEL
-- SECURITY. Sin grants a anon.
--
-- No edita migraciones anteriores. No aplicar desde el repo: ejecutar en el
-- SQL editor de Supabase ANTES de desplegar el código que usa estas columnas
-- y esta tabla.

ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS cc_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bcc_address text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.email_mailbox_signatures (
  mailbox_address text PRIMARY KEY,
  signature text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT email_mailbox_signatures_mailbox_check CHECK (
    mailbox_address IN (
      'hola@galladev.com',
      'ociel@galladev.com'
    )
  ),
  CONSTRAINT email_mailbox_signatures_length_check CHECK (
    char_length(signature) <= 2000
  )
);

DROP TRIGGER IF EXISTS trg_email_mailbox_signatures_updated_at
  ON public.email_mailbox_signatures;
CREATE TRIGGER trg_email_mailbox_signatures_updated_at
  BEFORE UPDATE ON public.email_mailbox_signatures
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.email_mailbox_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_mailbox_signatures FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_mailbox_signatures FROM anon;

DROP POLICY IF EXISTS "email_mailbox_signatures_admin_select"
  ON public.email_mailbox_signatures;
CREATE POLICY "email_mailbox_signatures_admin_select"
  ON public.email_mailbox_signatures
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_mailbox_signatures_admin_insert"
  ON public.email_mailbox_signatures;
CREATE POLICY "email_mailbox_signatures_admin_insert"
  ON public.email_mailbox_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_mailbox_signatures_admin_update"
  ON public.email_mailbox_signatures;
CREATE POLICY "email_mailbox_signatures_admin_update"
  ON public.email_mailbox_signatures
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');

GRANT SELECT, INSERT, UPDATE ON public.email_mailbox_signatures TO authenticated;
