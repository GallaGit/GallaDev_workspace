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

- Auth: producción requiere `AUTH_SECRET` + `AUTH_PASSWORD` con `SESSION_TTL_DAYS` entre 1 y 90. `AUTH_DISABLED=true` es solo para desarrollo local.
- Epoch de sesión: las cookies llevan `sv`. Se incrementa con `POST /api/auth/logout-all` (escribe `data/session-epoch.json` + `process.env`) o configura `SESSION_EPOCH` en Vercel para que todos los isolates Edge/Node coincidan. El sliding refresh mantiene el `sv` actual.
- La ingesta pública (`POST /api/ingest/lead`, `POST /api/ingest/n8n`) está protegida con bearer token (`INGEST_SECRET`); reporta un bypass de auth como severidad alta.
- El email transaccional (Resend) es fail-open por diseño — el lead se guarda aunque falle el email. No lo reportes como bug.
