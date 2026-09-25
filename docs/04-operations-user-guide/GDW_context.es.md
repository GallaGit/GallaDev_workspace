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

## Demo de visitante

El login puede ofrecer **Entrar como visitante** («Ver demo sin cuenta»). La sesión es una cookie httpOnly firmada (`gdw_visitor`, 4 horas). No es Admin, Seller ni Viewer, y no abre el repositorio de leads de Supabase ni el cliente service role. La UI muestra unas veinte asesorías ficticias (correos `example.com`). Algunos leads traen un análisis de dolores ya escrito, así el panel lo enseña sin llamar a un modelo. Mover una tarjeta del Kanban muestra un aviso en español y no se guarda. Settings, automatizaciones, equipo, ingesta, la página de email y el análisis IA real quedan bloqueados (HTTP 403). Las respuestas de la demo envían `X-Robots-Tag: noindex, nofollow` (el layout de la app ya es `noindex`).

| Variable | Papel |
| --- | --- |
| `DEMO_MODE_ENABLED` | `true` o `1` enciende la demo. **Si no está, está vacía o es otro valor, queda apagada.** |
| `DEMO_SESSION_SECRET` | Secreto HMAC, al menos 16 caracteres. Obligatorio con el flag encendido. Generar con `openssl rand -hex 32`. |

Para desactivarla en producción sin cambiar código: `DEMO_MODE_ENABLED=false` o borrar la variable, y reiniciar o redesplegar para que el proceso lea el entorno. La entrada está limitada (8 peticiones / 15 minutos / IP). El servidor de Playwright enciende el flag solo para el E2E; producción sigue apagada hasta que definas las variables.

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
