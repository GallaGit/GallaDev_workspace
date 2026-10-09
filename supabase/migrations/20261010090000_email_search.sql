-- Búsqueda en Correo: full-text (Postgres FTS) por remitente, asunto y cuerpo.
--
-- Añade columnas tsvector GENERADAS (STORED) con índice GIN:
--   email_messages.search_tsv = asunto (spanish, peso A)
--                             + remitente nombre/email (simple, peso A)
--                             + body_text (spanish, peso C, primeros 100 000 caracteres)
--   email_threads.search_tsv  = asunto (spanish) + remitente (simple)
--
-- El email se parte en palabras (ana@example.com → ana example com) para que
-- buscar «ana» o «example» encuentre al remitente.
--
-- Seguro para filas existentes: las columnas generadas se calculan solas para
-- todas las filas al añadirlas (reescribe la tabla una vez). No borra nada.
-- RLS sin cambios: las columnas nuevas quedan bajo las policies actuales
-- (solo Admin) y FORCE ROW LEVEL SECURITY. No hay grants ni funciones nuevas.
--
-- No edita migraciones anteriores. No aplicar desde el repo: ejecutar a mano
-- en el SQL editor de Supabase ANTES de desplegar el código que usa `q`.

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish'::regconfig, coalesce(subject, '')), 'A')
    || setweight(
      to_tsvector(
        'simple'::regconfig,
        coalesce(from_name, '') || ' ' || translate(coalesce(from_address, ''), '@._-+', '     ')
      ),
      'A'
    )
    || setweight(to_tsvector('spanish'::regconfig, left(coalesce(body_text, ''), 100000)), 'C')
  ) STORED;

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish'::regconfig, coalesce(subject, '')), 'A')
    || setweight(
      to_tsvector(
        'simple'::regconfig,
        coalesce(from_name, '') || ' ' || translate(coalesce(from_address, ''), '@._-+', '     ')
      ),
      'A'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_email_messages_search_tsv
  ON public.email_messages USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS idx_email_threads_search_tsv
  ON public.email_threads USING GIN (search_tsv);
