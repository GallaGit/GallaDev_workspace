# Documentación — Leads_CRM

Este directorio reúne la documentación funcional y técnica de Leads_CRM, la app de prospección para asesorías y gestorías.

## Estructura

```
docs/
├── product/          # Contexto de negocio, decisiones, roadmap
│   ├── CONTEXTO_NEGOCIO.md
│   ├── DECISIONES.md
│   ├── ROADMAP.md
│   └── CONTRACT-pain-analysis.md
├── architecture/     # Arquitectura, integraciones, estado técnico
│   ├── ARQUITECTURA.md
│   ├── INTEGRACIONES.md
│   └── ESTADO_IMPLEMENTACION.md
├── guides/           # Guías de uso y operación
│   ├── GUIA_USO.md
│   └── README.md     # (este archivo, entrada principal)
├── sessions/         # Registro de sesiones de desarrollo
│   ├── SESION-2026-09-04-dev-pass.md
│   ├── SESION-2026-09-12-fix-dark-mode.md
│   └── SESION-2026-09-12-filtros-leads-compactos.md
├── ux/               # Especificaciones de UX/UI
│   └── SPEC-detectar-dolores-drawer.md
└── diagrams/         # Diagramas de arquitectura (archify)
    ├── leads-crm.architecture.json
    ├── leads-crm-architecture.html
    └── *.png
```

## Lectura recomendada (orden)

1. **Producto**: [`product/CONTEXTO_NEGOCIO.md`](product/CONTEXTO_NEGOCIO.md) → [`product/DECISIONES.md`](product/DECISIONES.md) → [`product/ROADMAP.md`](product/ROADMAP.md)
2. **Arquitectura**: [`architecture/ARQUITECTURA.md`](architecture/ARQUITECTURA.md) → [`architecture/INTEGRACIONES.md`](architecture/INTEGRACIONES.md)
3. **Guías**: [`guides/GUIA_USO.md`](guides/GUIA_USO.md) (instalación, operación diaria)
4. **Sesiones**: [`sessions/`](sessions/) para historial de cambios recientes
5. **UX**: [`ux/SPEC-detectar-dolores-drawer.md`](ux/SPEC-detectar-dolores-drawer.md)
6. **Diagramas**: [`diagrams/`](diagrams/) para vistas visuales del sistema

## Jerarquía de fuentes

Cuando dos documentos se contradigan, se aplica este orden:

1. [`product/DECISIONES.md`](product/DECISIONES.md), por ser la especificación vigente.
2. Código en `src/`, para describir el comportamiento realmente implementado.
3. [`product/ROADMAP.md`](product/ROADMAP.md), para trabajo futuro.
4. Notas de investigación en [`../Nicho/Asesoria y gestoria/contexto/1_notes.md`](../Nicho/Asesoria%20y%20gestoria/contexto/1_notes.md), que conservan decisiones históricas y contexto de negocio.

Las notas de `Nicho` son una fuente de investigación, no una especificación técnica vigente.

## Alcance actual (resumen)

La aplicación es local y de un solo usuario. Permite sincronizar leads desde Notion (entrada n8n = estado `Nuevo`), buscarlos, filtrarlos, abrir un panel de detalle, editar estado/notas/email, marcar favoritos y archivar registros.

Daily Work (incluye `Nuevo` + borradores), Kanban, Email, Statistics y Duplicados (merge seguro de campos vacíos) están operativos. Settings e Integraciones permiten configurar y probar conexiones; webhooks CRM → n8n quedan fuera de v1. **Detectar dolores** analiza un lead con Groq y persiste `Análisis IA`.