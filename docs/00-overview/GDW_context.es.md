# Documentación de GallaDev Workspace

## Propósito

GallaDev Workspace es un CRM para revisar, cualificar y gestionar leads de asesorías y gestorías. Esta documentación se mantiene en inglés y español. El contexto inglés es `GDW_context.md`; el contexto español es `GDW_context.es.md`.

## Mapa documental

- `00-overview`: propósito, orden de lectura, terminología y jerarquía de fuentes.
- `01-business-product`: contexto de negocio y decisiones de producto.
- `02-roadmap-delivery`: roadmap, hitos, estado de implementación y evidencias de verificación.
- `03-architecture-integrations`: arquitectura, persistencia, seguridad e integraciones.
- `04-operations-user-guide`: instalación, configuración, operación diaria y diagnóstico.
- `05-ux-ai-contracts`: especificación UX y contrato del análisis de dolores con IA.
- `06-history-maintenance`: sesiones de desarrollo y notas históricas de mantenimiento.
- `diagrams`: diagramas de arquitectura y artefactos de comprobación visual.
- `archive`: script histórico de migración; no forma parte del runtime.

## Orden recomendado de lectura

1. Contexto de negocio y producto.
2. Arquitectura e integraciones actuales.
3. Roadmap y estado de implementación.
4. Guía de operación y uso.
5. Contratos UX y de IA.
6. Notas históricas solo al investigar un cambio pasado.

## Jerarquía de fuentes

Cuando dos documentos discrepen, se aplica este orden:

1. El código actual en `src/` y el esquema activo de Supabase.
2. Las decisiones de producto de `01-business-product`.
3. El contexto de arquitectura e integraciones de `03-architecture-integrations`.
4. El roadmap de `02-roadmap-delivery`.
5. Las notas históricas de `06-history-maintenance`.

Supabase es la fuente actual de verdad de los leads. Las referencias a Notion describen la migración histórica salvo que se indiquen explícitamente como actuales.

## Resumen actual del producto

La aplicación permite captar leads, buscarlos, filtrarlos, editar su detalle, usar Kanban, revisar emails, consultar estadísticas, gestionar duplicados, configurar integraciones y ejecutar análisis de dolores con IA. Todo lead nuevo entra en estado `Nuevo` y lleva un valor `Origen`. n8n es opcional; la alta manual y la ingesta web siguen siendo vías válidas.

El primer objetivo de validación SaaS es `signup/login -> leads -> Kanban -> email -> cambio de estado`, impidiendo que cada usuario lea o modifique leads ajenos.
