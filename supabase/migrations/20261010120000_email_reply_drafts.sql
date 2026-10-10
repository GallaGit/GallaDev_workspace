-- Correo: borradores de respuesta por hilo (autoguardado en el formulario de respuesta).
--
-- Añade a email_drafts:
--   thread_id  uuid NULL → email_threads(id) ON DELETE CASCADE
--              NULL = borrador de mensaje nuevo (compose, como hasta ahora).
--              Con valor = borrador de respuesta de ese hilo (máx. 1 por hilo).
--   reply_mode text NOT NULL DEFAULT 'reply' ('reply' | 'replyAll').
--
-- RLS: no cambia. Las policies Admin de email_drafts cubren las columnas nuevas.
-- No hay grants nuevos.
--
-- No edita migraciones anteriores. No aplicar desde el repo: ejecutar en el
-- SQL editor de Supabase ANTES de desplegar el código que usa estas columnas.

ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.email_threads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reply_mode text NOT NULL DEFAULT 'reply';

ALTER TABLE public.email_drafts
  DROP CONSTRAINT IF EXISTS email_drafts_reply_mode_check;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_reply_mode_check CHECK (reply_mode IN ('reply', 'replyAll'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_drafts_thread_unique
  ON public.email_drafts (thread_id)
  WHERE thread_id IS NOT NULL;
