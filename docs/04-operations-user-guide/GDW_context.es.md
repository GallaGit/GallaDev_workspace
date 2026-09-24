# Guía De Operación Y Uso

## Requisitos y configuración

- Node.js 20 o superior.
- npm.
- Un proyecto Supabase con las migraciones necesarias aplicadas.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura en `.env.local` la URL de Supabase y las claves publishable/secret. Usa `AUTH_DISABLED=true` solo en desarrollo local. Nunca subas credenciales al repositorio.

## Rutas principales

- `/leads`: lista, filtros, panel de detalle y alta manual.
- `/inbox`: colas de Daily Work.
- `/kanban`: los nueve estados del pipeline.
- `/email`: revisión de borradores y soporte de Gmail Compose.
- Settings: estado de integraciones, seguridad y configuración enmascarada.

## Operación diaria

Los leads nuevos entran en la cola `Nuevo`. Se puede buscar por empresa, dominio, email, ciudad, provincia o LinkedIn; combinar filtros; editar notas y borradores; cambiar el estado; archivar registros y gestionar duplicados. La aplicación guarda los cambios en Supabase.

## Roles y límites de IA

El rol sale de `profiles.app_role`: Admin, Seller o Viewer.

- **Admin:** mutaciones de settings y automatizaciones, `GET /api/team`, escrituras de leads y análisis IA.
- **Seller:** escrituras de leads y análisis IA (con el límite de tasa). No cambia settings ni automatizaciones y no lista el equipo.
- **Viewer:** solo lectura. Las APIs de escritura responden 403.

El análisis IA (`POST /api/leads/:id/analyze` y `POST /api/leads/pain-analysis`) admite 10 peticiones / 60s por usuario de la sesión (límite en memoria). Usa la sesión autenticada y RLS; las peticiones normales de usuario no usan el rol privilegiado `service_role`.

Comprobación de vida para uptime: `GET /api/health` (sin sesión). Responde `{"ok":true}` si el proceso atiende HTTP. No comprueba Supabase.

## Diagnóstico

- Si login o la invalidación de sesiones devuelve 503, comprueba la conexión con Supabase y que esté aplicada la migración del epoch de sesiones.
- Si falla una integración, revisa el estado de Settings y los logs del servidor sin exponer credenciales.
- Si fallan TypeScript o el build, resuelve la discrepancia entre código y esquema antes de considerar completado un hito.

## Comandos de calidad

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
```
