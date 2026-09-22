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
