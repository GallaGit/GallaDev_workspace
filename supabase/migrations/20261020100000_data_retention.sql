-- Retención de datos personales (GDW): purga de leads inactivos y su correo.
--
-- purge_expired_personal_data(dry_run) calcula qué leads caducaron y qué hilos
-- de correo van con ellos. Por defecto solo cuenta (dry_run = true, y también
-- con dry_run = NULL); con dry_run = false borra en la misma transacción.
--
-- Ventanas de retención:
--   * Lead no cliente: 12 meses sin actividad.
--   * Cliente (estado 'Cliente' o actividad que lo menciona, se trata de forma
--     conservadora): 6 años sin actividad.
--   * Hilos de correo ligados a un candidato: 12 meses desde el último mensaje.
--     Los hilos más recientes se conservan; su lead_id queda en NULL por FK
--     (ON DELETE SET NULL) al borrar el lead.
--
-- El conjunto de candidatos se materializa en temporales: el recuento, el
-- RAISE LOG y el borrado usan exactamente el mismo snapshot.
-- Solo se devuelven recuentos; el único dato no personal devuelto son las rutas
-- de Storage (claves opacas de objeto), que la app borra después del RPC.
-- No se programa con pg_cron: el disparo es el cron de Vercel (vercel.json)
-- llamando a GET /api/cron/retention con CRON_SECRET.

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

  -- 3. Recuentos (sin datos personales).
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

  -- Rutas opacas de los adjuntos de esos hilos (claves de objeto, sin PII).
  SELECT COALESCE(
    jsonb_agg(att.storage_path ORDER BY att.storage_path)
      FILTER (WHERE att.storage_path IS NOT NULL),
    '[]'::jsonb
  )
  INTO v_paths
  FROM public.email_attachments att
  WHERE att.message_id IN (
    SELECT m.id
    FROM public.email_messages m
    WHERE m.thread_id IN (SELECT x.id FROM pg_temp.expired_threads x)
  );

  SELECT count(*) INTO v_drafts
  FROM public.email_drafts d
  WHERE d.lead_id IN (SELECT c.id FROM pg_temp.candidates c);

  RAISE LOG 'purge_expired_personal_data dry_run=% leads=% clients=% threads=%',
    v_dry_run, v_leads, v_clients, v_threads;

  -- 4. Borrado con el mismo snapshot que el recuento.
  IF NOT v_dry_run THEN
    DELETE FROM public.email_drafts d
    WHERE d.lead_id IN (SELECT c.id FROM pg_temp.candidates c);

    -- messages y attachments caen en cascada (FK ON DELETE CASCADE).
    DELETE FROM public.email_threads t
    WHERE t.id IN (SELECT x.id FROM pg_temp.expired_threads x);

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
