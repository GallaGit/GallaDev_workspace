-- Dual mailbox V1: mailbox_address on email_threads (hola@ + ociel@).
-- Existing threads were only for hola@; backfill accordingly.

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS mailbox_address text NOT NULL DEFAULT 'hola@galladev.com';

UPDATE public.email_threads
SET mailbox_address = 'hola@galladev.com'
WHERE mailbox_address IS NULL
   OR mailbox_address = '';

ALTER TABLE public.email_threads
  DROP CONSTRAINT IF EXISTS email_threads_mailbox_address_check;

ALTER TABLE public.email_threads
  ADD CONSTRAINT email_threads_mailbox_address_check
  CHECK (
    mailbox_address IN (
      'hola@galladev.com',
      'ociel@galladev.com'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox
  ON public.email_threads (mailbox_address);
