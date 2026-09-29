-- Email Inbox (company-email spec, Phase 1): threads, messages, attachments.
--
-- Módulo Correo de GDW. Almacena correo entrante/saliente para hola@galladev.com.
-- El webhook de Resend escribe con service_role (bypass RLS).
-- Las lecturas pasan por sesión + RLS: solo Admin hasta que se decida lo contrario.
--
-- Idempotencia: resend_email_id es UNIQUE en email_messages.
-- Threading: message_id (RFC Message-ID) + references para enlazar hilos.

-- 1. Tabla de hilos
CREATE TABLE IF NOT EXISTS public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT '(sin asunto)',
  -- Enlace opcional con un lead existente (Phase 2 UI).
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  -- Primer remitente externo del hilo.
  from_address text NOT NULL,
  from_name text,
  -- Último mensaje recibido o enviado.
  last_message_at timestamptz NOT NULL DEFAULT now(),
  -- Leído/no leído (Phase 2 UI).
  is_read boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabla de mensajes (entrantes y salientes)
CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  -- Id de Resend (idempotencia).
  resend_email_id text UNIQUE NOT NULL,
  -- RFC Message-ID para threading.
  message_id text,
  -- in_reply_to y references para reconstruir el hilo.
  in_reply_to text,
  "references" text,
  -- Dirección del mensaje.
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address text NOT NULL,
  from_name text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  bcc_addresses text[] NOT NULL DEFAULT '{}',
  subject text,
  -- Cuerpos (cargados via Receiving API tras el webhook).
  body_html text,
  body_text text,
  -- Estado de envío (outbound Phase 3).
  send_status text NOT NULL DEFAULT 'delivered' CHECK (send_status IN ('delivered', 'sending', 'failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Metadatos de adjuntos (sin bytes hasta que haya bucket de Storage).
CREATE TABLE IF NOT EXISTS public.email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  -- Id del adjunto en Resend.
  resend_attachment_id text,
  filename text NOT NULL DEFAULT 'sin-nombre',
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint,
  -- URL de Storage cuando se implemente el bucket.
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. updated_at en email_threads (reutiliza handle_updated_at de init_leads).
DROP TRIGGER IF EXISTS trg_email_threads_updated_at ON public.email_threads;
CREATE TRIGGER trg_email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON public.email_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_lead_id ON public.email_threads (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_threads_is_read ON public.email_threads (is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages (thread_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON public.email_messages (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_resend_id ON public.email_messages (resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON public.email_attachments (message_id);

-- 6. RLS
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- Solo Admin puede leer (decisión por defecto, spec §7).
-- El webhook escribe con service_role (bypass RLS), así que no hay policy INSERT
-- para authenticated.
DROP POLICY IF EXISTS "email_threads_admin_read" ON public.email_threads;
CREATE POLICY "email_threads_admin_read"
  ON public.email_threads
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_threads_admin_update" ON public.email_threads;
CREATE POLICY "email_threads_admin_update"
  ON public.email_threads
  FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');

DROP POLICY IF EXISTS "email_messages_admin_read" ON public.email_messages;
CREATE POLICY "email_messages_admin_read"
  ON public.email_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
    )
  );

DROP POLICY IF EXISTS "email_attachments_admin_read" ON public.email_attachments;
CREATE POLICY "email_attachments_admin_read"
  ON public.email_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_messages m
      WHERE m.id = email_attachments.message_id
    )
  );

-- 7. Grants
GRANT SELECT, UPDATE ON public.email_threads TO authenticated;
GRANT SELECT ON public.email_messages TO authenticated;
GRANT SELECT ON public.email_attachments TO authenticated;
