-- Correo, mejora 6: origen de la vinculación hilo ↔ lead.
--
-- lead_link_source:
--   'manual' → la fijó (o quitó) una persona desde la UI. El auto-vinculado
--              nunca la sobrescribe ni re-vincula un hilo desvinculado a mano.
--   'auto'   → la hizo el sistema al recibir/enviar correo (o el backfill).
--   NULL     → hilo sin decisión previa (elegible para auto-vinculado).
--
-- Idempotente. No cambia RLS ni grants: email_threads ya concede SELECT/UPDATE
-- a authenticated con policies solo Admin y el webhook/compose escriben con
-- service_role. Debe aplicarse ANTES de desplegar el código que la usa.

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS lead_link_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_threads_lead_link_source_check'
      AND conrelid = 'public.email_threads'::regclass
  ) THEN
    ALTER TABLE public.email_threads
      ADD CONSTRAINT email_threads_lead_link_source_check
      CHECK (lead_link_source IS NULL OR lead_link_source IN ('manual', 'auto'));
  END IF;
END $$;

-- Las vinculaciones existentes las hizo una persona: se marcan como manuales.
UPDATE public.email_threads
SET lead_link_source = 'manual'
WHERE lead_id IS NOT NULL
  AND lead_link_source IS NULL;
