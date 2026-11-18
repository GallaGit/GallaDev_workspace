-- Purga definitiva de hilos en Papelera (GDW): 30 días en trashed_at.
--
-- IMPORTANTE: Ociel debe aplicar este archivo manualmente en el SQL Editor de
-- Supabase ANTES DE DESPLEGAR (BEFORE deploy). La ruta del cron ya llama a esta
-- misma función; mientras no se aplique, la Papelera no se purga.
--
-- CREATE OR REPLACE de public.purge_expired_personal_data: conserva íntegramente
-- la retención de leads (12 meses / 6 años) y añade la purga de Papelera.
-- La ventana de 30 días coincide con TRASH_RETENTION_DAYS en
-- src/lib/email/thread-state.ts (la UI avisa de ese mismo plazo).
--
-- Por defecto (dry_run true o NULL) solo cuenta. Con dry_run false borra en la
-- misma transacción: los mensajes, adjuntos y borradores ligados al hilo caen
-- por FK ON DELETE CASCADE; los leads NO se tocan aquí.
-- Solo se devuelven recuentos y rutas opacas de Storage (sin PII).

CREATE OR REPLACE FUNCTION public.purge_expired_personal_data(dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- dry_run NULL se trata como true (por seguridad, solo se cuenta).
  v_dry_run boolean := COALESCE(dry_run, true);
  v_leads integer := 0;
  v_clients integer := 0;
  v_activities integer := 0;
  v_threads integer := 0;
  v_messages integer := 0;
  v_attachments integer := 0;
  v_drafts integer := 0;
  v_trashed_threads integer := 0;
  v_trashed_messages integer := 0;
  v_trashed_attachments integer := 0;
  v_paths jsonb := '[]'::jsonb;
BEGIN
  -- 1. Candidatos: leads caducados + su banda (cliente/no cliente).
  --    GREATEST ignora NULL; created_at es NOT NULL, así que nunca da NULL.
  DROP TABLE IF EXISTS pg_temp.candidates;
  CREATE TEMP TABLE candidates ON COMMIT DROP AS
  WITH enriched AS (
    SELECT
      l.id,
      (l.status = 'Cliente'
        OR EXISTS (
          SELECT 1
          FROM public.lead_activities a
          WHERE a.lead_id = l.id
            AND a.message ILIKE '%Cliente%'
        )) AS is_client,
      GREATEST(
        l.created_at,
        l.updated_at,
        l.discovered_at,
        l.notion_last_edited_time,
        l.last_activity::timestamptz,
        l.last_contact::timestamptz,
        l.next_follow_up::timestamptz,
        (SELECT max(a.at) FROM public.lead_activities a WHERE a.lead_id = l.id),
        (SELECT max(t.last_message_at) FROM public.email_threads t WHERE t.lead_id = l.id),
        (SELECT max(d.updated_at) FROM public.email_drafts d WHERE d.lead_id = l.id)
      ) AS last_activity_at
    FROM public.leads l
  )
  SELECT id, is_client
  FROM enriched
  WHERE (NOT is_client AND last_activity_at < now() - interval '12 months')
     OR (is_client AND last_activity_at < now() - interval '6 years');

  -- 2. Hilos de correo caducados de esos candidatos (los vivos se quedan).
  DROP TABLE IF EXISTS pg_temp.expired_threads;
  CREATE TEMP TABLE expired_threads ON COMMIT DROP AS
  SELECT t.id
  FROM public.email_threads t
  WHERE t.lead_id IN (SELECT c.id FROM pg_temp.candidates c)
    AND t.last_message_at < now() - interval '12 months';

  -- 2b. Hilos en Papelera desde hace más de 30 días (TRASH_RETENTION_DAYS).
  DROP TABLE IF EXISTS pg_temp.expired_trash_threads;
  CREATE TEMP TABLE expired_trash_threads ON COMMIT DROP AS
  SELECT t.id
  FROM public.email_threads t
  WHERE t.trashed_at IS NOT NULL
    AND t.trashed_at < now() - interval '30 days';

  -- 3. Recuentos (sin datos personales). Los de Papelera van aparte para no
  --    alterar los totales históricos de retención de leads.
  SELECT
    count(*) FILTER (WHERE NOT c.is_client),
    count(*) FILTER (WHERE c.is_client)
  INTO v_leads, v_clients
  FROM pg_temp.candidates c;

  SELECT count(*) INTO v_activities
  FROM public.lead_activities a
  WHERE a.lead_id IN (SELECT c.id FROM pg_temp.candidates c);

  SELECT count(*) INTO v_threads
  FROM pg_temp.expired_threads;

  SELECT count(*) INTO v_messages
  FROM public.email_messages m
  WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_threads x);

  SELECT count(*) INTO v_attachments
  FROM public.email_attachments att
  WHERE att.message_id IN (
    SELECT m.id
    FROM public.email_messages m
    WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_threads x)
  );

  SELECT count(*) INTO v_trashed_threads
  FROM pg_temp.expired_trash_threads;

  SELECT count(*) INTO v_trashed_messages
  FROM public.email_messages m
  WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_trash_threads x);

  SELECT count(*) INTO v_trashed_attachments
  FROM public.email_attachments att
  WHERE att.message_id IN (
    SELECT m.id
    FROM public.email_messages m
    WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_trash_threads x)
  );

  -- Rutas opacas de ambos conjuntos (UNION evita duplicados si un hilo
  -- caducado por lead también estaba en Papelera).
  SELECT COALESCE(
    jsonb_agg(p.storage_path ORDER BY p.storage_path)
      FILTER (WHERE p.storage_path IS NOT NULL),
    '[]'::jsonb
  )
  INTO v_paths
  FROM (
    SELECT att.storage_path
    FROM public.email_attachments att
    WHERE att.message_id IN (
      SELECT m.id
      FROM public.email_messages m
      WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_threads x)
    )
    UNION
    SELECT att.storage_path
    FROM public.email_attachments att
    WHERE att.message_id IN (
      SELECT m.id
      FROM public.email_messages m
      WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_trash_threads x)
    )
  ) AS p;

  SELECT count(*) INTO v_drafts
  FROM public.email_drafts d
  WHERE d.lead_id IN (SELECT c.id FROM pg_temp.candidates c);

  RAISE LOG 'purge_expired_personal_data dry_run=% leads=% clients=% threads=% trashed_threads=%',
    v_dry_run, v_leads, v_clients, v_threads, v_trashed_threads;

  -- 4. Borrado con el mismo snapshot que el recuento.
  IF NOT v_dry_run THEN
    DELETE FROM public.email_drafts d
    WHERE d.lead_id IN (SELECT c.id FROM pg_temp.candidates c);

    -- messages y attachments caen en cascada (FK ON DELETE CASCADE).
    DELETE FROM public.email_threads t
    WHERE t.id IN (SELECT x.id FROM pg_temp.expired_threads x);

    -- Papelera: messages, attachments y email_drafts.thread_id en cascada.
    -- No se borra ningún lead desde aquí.
    DELETE FROM public.email_threads t
    WHERE t.id IN (SELECT x.id FROM pg_temp.expired_trash_threads x);

    -- lead_activities cae en cascada; los hilos vivos apuntan a NULL por FK.
    DELETE FROM public.leads l
    WHERE l.id IN (SELECT c.id FROM pg_temp.candidates c);
  END IF;

  RETURN jsonb_build_object(
    'dry_run', v_dry_run,
    'leads', v_leads,
    'clients', v_clients,
    'activities', v_activities,
    'email_threads', v_threads,
    'email_messages', v_messages,
    'email_attachments', v_attachments,
    'email_drafts', v_drafts,
    'trashed_threads', v_trashed_threads,
    'trashed_messages', v_trashed_messages,
    'trashed_attachments', v_trashed_attachments,
    'storage_paths', v_paths
  );
END;
$$;

-- Solo el service_role (la ruta del cron) puede ejecutarla; ni anon ni
-- authenticated, que además no deben ni poder contar estos volúmenes.
REVOKE ALL ON FUNCTION public.purge_expired_personal_data(boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.purge_expired_personal_data(boolean)
  TO service_role;
