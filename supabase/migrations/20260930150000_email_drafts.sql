-- Compose + drafts V1: email_drafts for new messages (not reply drafts).
-- Admin-only via RLS. Distinct from /email lead drafts.

CREATE TABLE IF NOT EXISTS public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_address text NOT NULL DEFAULT 'hola@galladev.com',
  to_address text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_drafts_mailbox_address_check CHECK (
    mailbox_address IN (
      'hola@galladev.com',
      'ociel@galladev.com'
    )
  )
);

DROP TRIGGER IF EXISTS trg_email_drafts_updated_at ON public.email_drafts;
CREATE TRIGGER trg_email_drafts_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_email_drafts_updated
  ON public.email_drafts (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_drafts_mailbox
  ON public.email_drafts (mailbox_address);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_drafts_admin_select" ON public.email_drafts;
CREATE POLICY "email_drafts_admin_select"
  ON public.email_drafts
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_drafts_admin_insert" ON public.email_drafts;
CREATE POLICY "email_drafts_admin_insert"
  ON public.email_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_drafts_admin_update" ON public.email_drafts;
CREATE POLICY "email_drafts_admin_update"
  ON public.email_drafts
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_drafts_admin_delete" ON public.email_drafts;
CREATE POLICY "email_drafts_admin_delete"
  ON public.email_drafts
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'Admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
