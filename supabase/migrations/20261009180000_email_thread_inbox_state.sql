-- Correo tipo Gmail, primer tramo: archivar, papelera, fragmento y clip de adjunto.
--
-- Añade a email_threads:
--   archived_at     timestamptz  NULL = en Recibidos; con fecha = Archivados.
--   trashed_at      timestamptz  NULL = fuera de Papelera; con fecha = Papelera.
--   last_snippet    text         Hasta 200 caracteres del último mensaje (texto plano).
--   has_attachments boolean      true si algún mensaje del hilo tiene adjuntos.
--
-- Leído/no leído sigue en email_threads.is_read (ya existe).
--
-- Triggers (SECURITY INVOKER; quien escribe mensajes es service_role):
--   - email_messages INSERT/UPDATE de cuerpo → recalcula last_snippet.
--   - email_messages INSERT inbound → saca el hilo de Archivados (como Gmail).
--     Un hilo en Papelera se queda en Papelera.
--   - email_attachments INSERT → has_attachments = true.
--
-- RLS: no cambia. Las policies de email_threads (SELECT/UPDATE solo Admin)
-- y FORCE ROW LEVEL SECURITY cubren las columnas nuevas. No hay grants nuevos.
--
-- Papelera: los hilos con trashed_at de más de 30 días se podrán purgar
-- más adelante (tarea programada pendiente; esta migración no borra nada).
--
-- No edita migraciones anteriores. No aplicar desde el repo: ejecutar en el
-- SQL editor de Supabase ANTES de desplegar el código que usa estas columnas.

-- 1. Columnas
ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_snippet text,
  ADD COLUMN IF NOT EXISTS has_attachments boolean NOT NULL DEFAULT false;

-- 2. Índices parciales por vista
CREATE INDEX IF NOT EXISTS idx_email_threads_view_inbox
  ON public.email_threads (last_message_at DESC)
  WHERE archived_at IS NULL AND trashed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_threads_view_archived
  ON public.email_threads (last_message_at DESC)
  WHERE archived_at IS NOT NULL AND trashed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_threads_view_trash
  ON public.email_threads (trashed_at)
  WHERE trashed_at IS NOT NULL;

-- 3. Fragmento del último mensaje
CREATE OR REPLACE FUNCTION public.email_threads_refresh_snippet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  latest_text text;
  latest_html text;
  snippet text;
BEGIN
  SELECT m.body_text, m.body_html
    INTO latest_text, latest_html
  FROM public.email_messages m
  WHERE m.thread_id = NEW.thread_id
  ORDER BY m.received_at DESC, m.created_at DESC
  LIMIT 1;

  snippet := NULLIF(btrim(latest_text), '');
  IF snippet IS NULL AND latest_html IS NOT NULL THEN
    snippet := regexp_replace(latest_html, '<style.*?</style>', ' ', 'gi');
    snippet := regexp_replace(snippet, '<script.*?</script>', ' ', 'gi');
    snippet := regexp_replace(snippet, '<[^>]*>', ' ', 'g');
    snippet := replace(replace(replace(replace(replace(snippet,
      '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"');
  END IF;
  snippet := NULLIF(left(btrim(regexp_replace(coalesce(snippet, ''), '\s+', ' ', 'g')), 200), '');

  UPDATE public.email_threads
  SET last_snippet = snippet
  WHERE id = NEW.thread_id
    AND last_snippet IS DISTINCT FROM snippet;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.email_threads_refresh_snippet() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_threads_refresh_snippet() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_messages_refresh_snippet ON public.email_messages;
CREATE TRIGGER trg_email_messages_refresh_snippet
  AFTER INSERT OR UPDATE OF body_text, body_html ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.email_threads_refresh_snippet();

-- 4. Entrante nuevo → vuelve a Recibidos si estaba archivado
CREATE OR REPLACE FUNCTION public.email_threads_unarchive_on_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE public.email_threads
    SET archived_at = NULL
    WHERE id = NEW.thread_id
      AND archived_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.email_threads_unarchive_on_inbound() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_threads_unarchive_on_inbound() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_messages_unarchive_on_inbound ON public.email_messages;
CREATE TRIGGER trg_email_messages_unarchive_on_inbound
  AFTER INSERT ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.email_threads_unarchive_on_inbound();

-- 5. Clip de adjunto
CREATE OR REPLACE FUNCTION public.email_threads_flag_attachments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_threads t
  SET has_attachments = true
  FROM public.email_messages m
  WHERE m.id = NEW.message_id
    AND t.id = m.thread_id
    AND NOT t.has_attachments;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.email_threads_flag_attachments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_threads_flag_attachments() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_attachments_flag_thread ON public.email_attachments;
CREATE TRIGGER trg_email_attachments_flag_thread
  AFTER INSERT ON public.email_attachments
  FOR EACH ROW EXECUTE FUNCTION public.email_threads_flag_attachments();

-- 6. Relleno de filas existentes
UPDATE public.email_threads t
SET has_attachments = true
WHERE EXISTS (
  SELECT 1
  FROM public.email_messages m
  JOIN public.email_attachments a ON a.message_id = m.id
  WHERE m.thread_id = t.id
);

-- Fuerza el trigger de fragmento sobre el último mensaje de cada hilo.
UPDATE public.email_messages m
SET body_text = m.body_text
WHERE m.id IN (
  SELECT DISTINCT ON (thread_id) id
  FROM public.email_messages
  ORDER BY thread_id, received_at DESC, created_at DESC
);
