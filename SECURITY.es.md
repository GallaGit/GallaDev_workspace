# Política de seguridad

> **English:** [Security Policy in English](./SECURITY.md)

## Versiones soportadas

| Versión | Soportada |
|---|---|
| `master` (última) | Sí |
| Commits antiguos / forks | Solo best effort |

Desplegamos a producción (`https://workspace.galladev.com`) desde `master`. Si usas un fork o un commit antiguo, actualiza a `master` primero.

## Reportar una vulnerabilidad

**No abras un issue público.** Reporta en privado vía
[GitHub Security Advisories](https://github.com/GallaGit/GallaDev_workspace/security/advisories/new).

Incluye:

- Descripción e impacto.
- Pasos para reproducir (sin secretos reales ni datos personales).
- Rutas afectadas, commit y entorno.

Objetivo: confirmar recepción en 72 horas, compartir un plan de remediación y dar crédito a quien reporta (salvo que prefiera anonimato).

## Manejo de secretos y datos

- Nunca pongas claves reales, tokens, contraseñas ni datos de clientes en issues, PRs, logs o fixtures de test.
- Los secretos locales van en `.env.local` / `data/settings.local.json` (gitignoreados); los de producción, en las variables de entorno de Vercel.
- Si sospechas una filtración, rota la credencial de inmediato y avisa a un maintainer — borrarla en un commit posterior no basta (el historial de git la conserva).

## Notas de alcance

- La auth es Supabase Auth (email + contraseña). Los roles `Admin`, `Seller` y `Viewer` salen de `profiles.role`. Un usuario autenticado sin fila en `profiles`, con rol nulo o con un rol fuera de ese enum, queda denegado (`401`, `code: "no_profile"`) y la app muestra la pantalla de acceso pendiente. No hay alta pública: el registro público debe seguir apagado en el dashboard de Supabase. Un Admin crea las cuentas en Authentication → Users; `on_auth_user_created` inserta un perfil **sin rol**. El Admin asigna `Admin`, `Seller` o `Viewer` en Settings → Equipo (`PATCH /api/team`). Esa migración no cambia las filas que ya existen.
- RLS de leads: Admin lee y escribe todos, también los que no tienen responsable, y los asigna. Seller solo lee y escribe los leads cuyo `responsable` es su id (no puede vaciarlo ni pasarlo a otra persona). Viewer es solo lectura de toda la cartera, incluidos los leads sin responsable: es el rol de confianza de lectura en este workspace de un solo equipo. No hay rol manager. La API de leads usa el mismo predicado (lista, detalle, parche, archivo, fusión, score y el cambio de estado a Cliente).
- El HTML del correo de empresa se sanea con `sanitize-html` antes de guardarlo y otra vez antes de servirlo. La vista del hilo lo pinta en un iframe con `sandbox` (sin `allow-scripts`) y `srcdoc`. Se quitan imágenes remotas, URLs `data:`, scripts, manejadores de eventos, formularios y estilos en línea. La CSP de producción sale en cada petición desde `src/proxy.ts`: `script-src` lleva nonce y `'strict-dynamic'`, sin `'unsafe-inline'`. `style-src` sigue permitiendo `'unsafe-inline'` (sin nonce de estilo) porque la UI usa atributos style. `img-src` es solo `'self' blob:`. `connect-src` sigue permitiendo `https:` y `wss:` para llegar a Supabase.
- `AUTH_DISABLED=true` (o `1`) omite la sesión solo fuera de producción. En producción es fail-closed: con `NODE_ENV=production` la auth sigue activa. `AUTH_SECRET`, `AUTH_PASSWORD` y `SESSION_TTL_DAYS` no se usan.
- **Cerrar todas las sesiones** (Settings → Seguridad) llama a `supabase.auth.signOut({ scope: "global" })`. El logout de la barra lateral llama a `supabase.auth.signOut()` sin argumento `scope`. No existe `POST /api/auth/logout-all` y la app no lee `app_session_epoch`.
- Demo de visitante: cookie httpOnly firmada con HMAC-SHA256 (`gdw_visitor`, 4 horas) usando `DEMO_SESSION_SECRET` (al menos 16 caracteres). Apagada salvo que `DEMO_MODE_ENABLED` sea `true` o `1`. La sesión es de solo lectura, con datos ficticios, y no construye un cliente de Supabase. El proxy solo deja pasar una lista blanca (`/`, `/leads`, `/kanban`, `/stats`, `/inbox`, `/duplicates`, y lecturas de leads, sesión y sync). El resto redirige a `/leads` o responde `403` con `code: "demo_readonly"`. Producción usa un secreto aleatorio propio (`openssl rand -hex 32`), no un valor de CI. Playwright usa el secret de GitHub Actions `E2E_DEMO_SESSION_SECRET` si existe y tiene al menos 16 caracteres; si no, genera uno solo para ese proceso. CI sigue en verde sin ese secret.
- El acceso es `POST /api/auth/login` (el navegador no llama a `signInWithPassword`). Los fallos comparten un solo mensaje. El cupo es 20 intentos / 15 minutos por IP de plataforma y 10 / 15 minutos por cuenta (`consumeRateLimit`: Upstash si están `UPSTASH_REDIS_REST_*`; si no, memoria por instancia).
- `GET /api/db-status` usa el cliente de sesión y RLS. El estado JSON es `ok`, `auth`, `config` o `down`, con un mensaje fijo. No devuelve texto de Postgres ni usa el service role.
- `handle_new_user()` no es una RPC. La migración `20261002200000_revoke_handle_new_user_execute.sql` revoca `EXECUTE` a `PUBLIC`, `anon` y `authenticated`. Hay que aplicarla en el editor SQL de Supabase; no cambia filas. El trigger de alta sigue ejecutándose como dueño de la función.
- Compose, respuesta, borrador y PATCH de hilo de correo comparten un esquema: longitudes máximas, UUID y buzón de la lista. La respuesta vuelve a comprobar el destinatario guardado antes de enviar y rechaza un buzón fuera de la lista.
- Ingesta pública: `POST /api/ingest/lead` usa `INGEST_SECRET`. `POST /api/ingest/n8n` usa `N8N_INGEST_SECRET` cuando esa variable existe y es distinta. Si no está, n8n sigue aceptando `INGEST_SECRET` para no cortar un workflow ya desplegado; hay que definir el secreto dedicado para separarlos. Un bypass de auth es severidad alta.
- Las URLs salientes de n8n tienen que ser https, sin usuario ni contraseña, y no pueden apuntar a loopback, enlace local, rangos privados ni metadatos de nube. `N8N_ALLOWED_HOSTS` fija los hosts. La prueba de una automatización devuelve solo el código HTTP.
- El límite de tasa usa `x-vercel-forwarded-for` (si no, el último salto de `x-forwarded-for`). `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` comparten el contador; sin ellas cada instancia tiene su ventana. La ingesta web también tiene un cupo diario de acuses, independiente de la IP.
- El email transaccional (Resend) es fail-open por diseño — el lead se guarda aunque falle el email. No lo reportes como bug.
