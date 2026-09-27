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

- La auth es Supabase Auth (email + contraseña). Los roles `Admin`, `Seller` y `Viewer` salen de `profiles.role`. Un usuario autenticado sin fila en `profiles`, o con un rol fuera de ese enum, queda denegado (`401`, `code: "no_profile"`). No hay alta pública: un Admin crea las cuentas en el Dashboard de Supabase; el trigger `on_auth_user_created` asigna Seller.
- `AUTH_DISABLED=true` (o `1`) omite la sesión solo fuera de producción. En producción es fail-closed: con `NODE_ENV=production` la auth sigue activa. `AUTH_SECRET`, `AUTH_PASSWORD` y `SESSION_TTL_DAYS` no se usan.
- **Cerrar todas las sesiones** (Settings → Seguridad) llama a `supabase.auth.signOut({ scope: "global" })`. El logout de la barra lateral llama a `supabase.auth.signOut()` sin argumento `scope`. No existe `POST /api/auth/logout-all` y la app no lee `app_session_epoch`.
- Demo de visitante: cookie httpOnly firmada con HMAC-SHA256 (`gdw_visitor`, 4 horas) usando `DEMO_SESSION_SECRET` (al menos 16 caracteres). Apagada salvo que `DEMO_MODE_ENABLED` sea `true` o `1`. La sesión es de solo lectura, con datos ficticios, y no construye un cliente de Supabase. `/settings`, `/automations` y `/email` redirigen a `/leads`; las APIs bloqueadas responden `403` con `code: "demo_readonly"`.
- La ingesta pública (`POST /api/ingest/lead`, `POST /api/ingest/n8n`) está protegida con bearer token (`INGEST_SECRET`); reporta un bypass de auth como severidad alta.
- El email transaccional (Resend) es fail-open por diseño — el lead se guarda aunque falle el email. No lo reportes como bug.
