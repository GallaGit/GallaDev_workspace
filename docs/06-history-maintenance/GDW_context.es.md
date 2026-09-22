# Historial Y Mantenimiento

## Sesiones históricas

Este contexto consolida las antiguas notas de sesiones fechadas. Las fechas conservan trazabilidad, pero las entradas son históricas y no sustituyen al código actual ni al comportamiento de Supabase.

### 2026-09-04: pasada de desarrollo

Registró la base de desarrollo, las decisiones de producto y la transición desde un workspace individual hacia una validación SaaS por hitos.

### 2026-09-12: corrección de modo oscuro

Registró la corrección del modo oscuro y la verificación visual necesaria después de cambiar el tema y el layout compartidos.

### 2026-09-12: filtros compactos de leads

Registró el trabajo de compactación de filtros de leads y el comportamiento responsive esperado en la pantalla Leads.

## Política de archivo

Los scripts históricos se conservan solo cuando ayudan a explicar una migración o recuperación. `docs/archive/migrate-notion-to-supabase.mts` no forma parte del runtime y no debe conectarse a scripts de package sin una revisión deliberada.

## Reglas de mantenimiento

- Actualizar ambos archivos de idioma al cambiar el contexto canónico del producto.
- Separar el comportamiento actual de las decisiones históricas.
- Enlazar los diagramas generados desde el contexto de arquitectura en vez de duplicarlos como prosa.
- No guardar secretos, tokens ni datos de producción en la documentación.
