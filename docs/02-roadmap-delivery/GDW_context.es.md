# Roadmap Y Entrega

## Secuencia de entrega

- **M1 Seguro:** autenticación, invalidación de sesiones, límites de tasa, límites de cuerpo, cabeceras de seguridad y aislamiento por filas.
- **Validación SaaS mínima:** un segundo usuario completa el flujo principal sin ver leads ajenos.
- **M2 Sólido:** más pruebas, gates de CI, observabilidad, gestión de errores y documentación endurecida.
- **M3 SaaS comercial:** billing, automatización propia, realtime y capacidades de escala.

## Estado actual

Supabase es la capa de persistencia activa y la única fuente de verdad. La aplicación actual incluye leads, Kanban, email, Daily Work, estadísticas, duplicados, settings, base de autenticación, endpoints de ingesta y análisis IA. Las integraciones con n8n son opcionales y best-effort.

## Reglas de entrega

El trabajo se aísla con ramas y entornos, no con copias del repositorio. Los cambios de producto deben actualizar el contexto canónico y mantenerse alineados con el código y el esquema de base de datos. Los informes históricos de verificación son evidencias de su fecha, no garantías sobre el build actual.

## Evidencia de aceptación

Antes de marcar un hito como completado, hay que verificar lint, TypeScript, tests unitarios, tests de componentes, build, autenticación y RLS según corresponda. Los fallos y supuestos del entorno deben registrarse explícitamente. Ningún elemento futuro del roadmap debe presentarse como comportamiento actual sin código y evidencia de verificación.
