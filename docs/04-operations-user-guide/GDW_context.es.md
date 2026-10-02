# Guía De Operación Y Uso

## Requisitos y configuración

- Node.js 22 (igual que CI).
- npm.
- Un proyecto Supabase con las migraciones necesarias aplicadas.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura en `.env.local` `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`, más `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (la misma URL pública y la clave publishable; Next las incrusta en el build). Para el módulo Correo, añade `RESEND_API_KEY` y `RESEND_INBOUND_WEBHOOK_SECRET` (secreto de firma Svix del webhook de Resend). Usa `AUTH_DISABLED=true` solo en desarrollo local. Nunca subas credenciales al repositorio. No hay alta pública: déjala apagada en el dashboard y crea las cuentas en Authentication → Users. El trigger `on_auth_user_created` inserta el perfil sin rol. El Admin asigna Admin, Seller o Viewer en Settings → Equipo.

## Rutas principales

- `/`: panel (KPIs de Daily Work).
- `/leads`: lista, filtros (incluido **Mis leads**), panel de detalle, responsable y alta manual.
- `/inbox`: colas de Daily Work.
- `/kanban`: los nueve estados del pipeline. No hay control de “añadir tarjeta”.
- `/stats`: estadísticas. Selector de tipo de gráfico: Barras, Circular (donut), Área (clave `gdw-stats-chart-type` en `localStorage`).
- `/duplicates`: grupos de duplicados.
- `/correo`: buzón de empresa (`hola@` y `ociel@`). Inbox unificado con filtro, chip, Nuevo (compose Resend), Borradores, leer/responder, vincular a lead. Solo Admin. Sin carpetas Entrada/Enviados/Spam (ver spec company-email).
- `/email`: revisión de borradores y soporte de Gmail Compose. El visitante es redirigido a `/leads`.
- `/automations`: webhooks de automatización. El visitante es redirigido a `/leads`.
- `/settings`: estado de integraciones, seguridad y configuración enmascarada. El visitante es redirigido a `/leads`.

## Operación diaria

Los leads nuevos entran en la cola `Nuevo`. Se puede buscar por empresa, dominio, email, ciudad, provincia o LinkedIn; combinar filtros; editar notas y borradores; cambiar el estado; archivar registros y gestionar duplicados. La aplicación guarda los cambios en Supabase.

## Roles y límites de IA

El rol sale de `profiles.role` (enum de PostgreSQL `app_role`): Admin, Seller o Viewer.

- **Admin:** mutaciones de settings y automatizaciones, `GET /api/team`, escrituras de leads y análisis IA.
- **Seller:** escrituras de leads y análisis IA (con el límite de tasa) solo en leads cuyo responsable es él. No ve la cola sin asignar, no cambia settings ni automatizaciones y no lista el equipo.
- **Viewer:** solo lectura de toda la cartera, también de los leads sin responsable. Las APIs de escritura responden 403.
- **Sin rol:** la cuenta entra en `/pending` y no lee leads hasta que un Admin le asigne uno.

El análisis IA (`POST /api/leads/:id/analyze` y `POST /api/leads/pain-analysis`) admite 10 peticiones / 60s por usuario de la sesión (límite en memoria). Usa la sesión autenticada y RLS; las peticiones normales de usuario no usan el rol privilegiado `service_role`.

Comprobación de vida para uptime: `GET /api/health` (sin sesión). Responde `{"ok":true}` si el proceso atiende HTTP. No comprueba Supabase.

## Demo de visitante

La demo se mantiene. La activación en Vercel Production sigue pendiente. En la misma página de login, el slice «¿Qué es?» (especificado, no implementado) añade texto y capturas que no piden sesión y conviven con el botón. Ver [`what-it-is.es.md`](../02-roadmap-delivery/what-it-is.es.md).

El login puede ofrecer **Entrar como visitante** («Ver demo sin cuenta»). La sesión es una cookie httpOnly firmada con HMAC-SHA256 (`gdw_visitor`, 4 horas) usando `DEMO_SESSION_SECRET`. No es Admin, Seller ni Viewer, y no abre el repositorio de leads de Supabase ni el cliente service role. `getSessionLeadRepository()` devuelve `DemoLeadRepository`. La UI muestra asesorías españolas ficticias (correos `example.com`). Algunos leads traen un análisis de dolores ya escrito, así el panel lo enseña sin llamar a un modelo. Mover una tarjeta del Kanban muestra un aviso en español y no se guarda. Las páginas `/settings`, `/automations` y `/email` redirigen a `/leads`. Las APIs bloqueadas (equipo, settings, automatizaciones, db-status, ingesta, escrituras de leads, merge, score y el análisis IA real) responden HTTP 403 con `code: "demo_readonly"`. `GET /api/session` devuelve `visitor: true` y `role: null`. `POST /api/demo/enter` responde 404 `demo_disabled` con el flag apagado, 503 `demo_misconfigured` si el secreto falta o tiene menos de 16 caracteres, y 429 `rate_limited` tras 8 peticiones en 15 minutos por IP. Las respuestas de la demo envían `X-Robots-Tag: noindex, nofollow` (el layout de la app ya es `noindex`).

| Variable | Papel |
| --- | --- |
| `DEMO_MODE_ENABLED` | `true` o `1` enciende la demo. **Si no está, está vacía o es otro valor, queda apagada.** |
| `DEMO_SESSION_SECRET` | Secreto HMAC, al menos 16 caracteres. Obligatorio con el flag encendido. Generar con `openssl rand -hex 32`. |

Para desactivarla en producción sin cambiar código: `DEMO_MODE_ENABLED=false` o borrar la variable, y reiniciar o redesplegar para que el proceso lea el entorno. La entrada está limitada (8 peticiones / 15 minutos / IP). El servidor de Playwright enciende el flag solo para el E2E; producción sigue apagada hasta que definas las variables.

## Errores y logs

`src/app/error.tsx` y `src/app/global-error.tsx` muestran un fallback con reintento y enlace al inicio (`global-error` cubre un fallo del layout raíz). Los catch de ingesta y análisis escriben una línea JSON mediante `src/lib/route-log.ts`. Campos: `route`, `errorClass`, `status` cuando se informa, y `requestId` si la petición ya traía un `x-request-id` o `x-vercel-id` válido. `leadId` es opcional. Sin cuerpos, tokens ni datos personales.

## Diagnóstico

- Si el login falla o el navegador muestra un error de red, revisa `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`, y confirma que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estaban presentes en el **build**. Next no inyecta esas variables públicas en el cliente salvo con un acceso estático `process.env.NEXT_PUBLIC_*`, y hace falta reconstruir después de cambiarlas.
- Si un usuario autenticado recibe HTTP 401 con `code: "no_profile"`, o ve la pantalla «Acceso pendiente», esa cuenta no tiene un rol `Admin`, `Seller` o `Viewer`. El trigger ya no asigna Seller. Un Admin lo asigna en Settings → Equipo. La migración `20261002180000_least_privilege_signup_and_lead_rls.sql` hay que aplicarla en el SQL editor; no toca los roles que ya existen.
- **Cerrar todas las sesiones** llama a `supabase.auth.signOut({ scope: "global" })`. La app no tiene `POST /api/auth/logout-all` y no consulta `app_session_epoch`. Un 503 en `POST /api/demo/enter` significa que el flag de la demo está encendido y `DEMO_SESSION_SECRET` falta o es corto (`demo_misconfigured`), no un fallo del epoch de sesiones.
- Las páginas de visitante `/settings`, `/automations`, `/email` y `/correo` redirigen a `/leads`. Las APIs correspondientes responden 403 `demo_readonly`. `GET /api/session` incluye `visitor: true` con esa cookie.
- Si falla una integración, revisa el estado de Settings y los logs del servidor sin exponer credenciales.
- Si fallan TypeScript o el build, resuelve la discrepancia entre código y esquema antes de considerar completado un hito.

## Comandos de calidad

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
npm run test:e2e
```

Playwright arranca `npm run start` por su cuenta (`playwright.config.ts`), así que antes ejecuta `npm run build`. CI hace ese build antes de `npm run test:e2e`.
