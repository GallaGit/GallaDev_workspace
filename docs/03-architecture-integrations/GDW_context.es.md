# Arquitectura E Integraciones

## Arquitectura del runtime

La aplicación usa Next.js App Router. El navegador llama a route handlers del servidor; los repositorios de dominio desacoplan la UI de la persistencia. PostgreSQL en Supabase es la fuente actual de verdad de leads y actividad. Los secretos permanecen en el servidor.

```text
Navegador -> UI Next.js -> Route handlers -> Repositorio de leads -> Supabase
                                             -> Servicio de settings
                                             -> Proveedor opcional de automatización
```

## Persistencia y seguridad

- Los leads y las actividades viven en Supabase.
- `getLeadRepository()` selecciona la implementación activa del repositorio.
- La autenticación y el middleware protegen las rutas sensibles.
- RLS es la frontera de aislamiento de datos entre usuarios.
- Settings muestra previews enmascarados y nunca devuelve secretos completos.
- Los fallos de dispatch a n8n no hacen fallar la persistencia del lead.

## Integraciones

- **Supabase:** base de datos activa y fuente de verdad.
- **n8n:** proveedor opcional de prospección y automatización.
- **SerpAPI:** búsqueda externa usada por el workflow de prospección.
- **Groq:** extracción web, generación de emails y análisis de dolores.
- **Resend:** notificaciones transaccionales de la ingesta web.

## Contrato de ingesta

Cualquier fuente puede crear un lead con estado `Nuevo` y un `Origen` como `n8n`, `web-galladev` o `Manual`. El CRM cualifica todas las fuentes de la misma forma. Las notificaciones del CRM hacia automatizaciones están desactivadas por defecto, son best-effort y nunca bloquean la persistencia.

## Integración histórica con Notion

Notion fue la fuente de verdad anterior. El runtime se eliminó; el script de migración permanece en `docs/archive/` solo como referencia histórica. Los IDs y mapeos de propiedades de notas antiguas no deben interpretarse como configuración actual.

## Superficie principal de API

- `GET/POST/PATCH/DELETE /api/leads`
- `GET/PATCH /api/leads/:id`
- `POST /api/leads/:id/analyze`
- `POST /api/sync`
- `GET/PATCH /api/settings`
- `GET/PATCH/POST /api/automations/:action`
- `POST /api/ingest/lead`
- `POST /api/ingest/n8n`
