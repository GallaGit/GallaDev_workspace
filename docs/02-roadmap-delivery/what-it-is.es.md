# Sección «Qué es» — Sustituye La Demo De Visitante

> **Estado:** especificado, no implementado · decisión de Ociel, 26-27 Sep 2026 · **Actualizado:** 2026-09-27
> **Orden:** primer slice de los dos decididos esos días. El de idioma va después: [`i18n.es.md`](./i18n.es.md) (EN: [`i18n.md`](./i18n.md)).
> No presentar como comportamiento actual. El login sigue siendo el formulario de `src/app/login/page.tsx`. La demo de visitante (PR #55) sigue en el código y **apagada**; nunca se encendió en producción. Este slice la retira.

## 1. Decisión

La demo de visitante (botón «Entrar como visitante», cookie `gdw_visitor`, `DEMO_MODE_ENABLED`, `DEMO_SESSION_SECRET`, sesión de solo lectura con leads ficticios) queda **en desuso**.

En su lugar, la página de login muestra una sección pública **Qué es** (EN: **What it is**), en la misma página, al lado del formulario en pantallas anchas o debajo en pantallas estrechas. Quien solo quiere entender la herramienta la lee sin cuenta, sin cookie y sin tocar Supabase.

Motivo: es más simple y más barato que mantener una sesión de solo lectura en Supabase, no abre riesgo de auth ni de datos, y sirve a quien quiere entender la herramienta.

## 2. Qué queda superseded

No hay issue abierto de la demo. Estas líneas de documentación dejan de ser trabajo pendiente:

- Encender la demo en producción (`DEMO_MODE_ENABLED` / `DEMO_SESSION_SECRET`). No se enciende. Producción sigue apagada y el slice borra el camino.
- Fixtures de visitante que no llegaron a existir (p. ej. Statistics en el diario de sesión del 2026-09-25). No se añaden.
- «Portal dentro de la demo de visitante» en [`client-portal.es.md`](./client-portal.es.md). No hay demo que alojar.

El código de la demo describe el árbol de hoy hasta que este slice se implemente. No es el plan de producto.

## 3. Qué ve quien no ha entrado

La sección no sustituye el formulario. Email y contraseña siguen siendo la puerta del CRM. No hay alta pública.

El texto aprobado está en los dos idiomas. Hasta el slice de i18n, la página muestra el español (idioma por defecto). El inglés viaja en el mismo cambio, como copia de esa sección, para que el selector lo encienda después sin reescribirla. Un control solo de esta página es aceptable si no compite con el selector global; si complica el login, el inglés espera al slice de i18n.

### Español — título «Qué es»

GallaDev Workspace es un CRM para revisar, cualificar y gestionar leads de asesorías y gestorías.

Supabase (PostgreSQL) es la fuente de verdad. Los leads entran por la ingesta web o por un alta manual. El equipo los cualifica con un análisis de dolores por IA, los sigue en un Kanban, consulta estadísticas y trabaja con roles: Admin, Seller y Viewer.

Esta explicación se lee sin iniciar sesión. Entrar al CRM sigue pidiendo email y contraseña. No hay alta pública.

### English — title “What it is”

GallaDev Workspace is a CRM for reviewing, qualifying, and managing leads for asesorías y gestorías (advisory and accounting firms).

Supabase (PostgreSQL) is the source of truth. Leads come in through web ingest or manual entry. The team qualifies them with AI pain analysis, follows them on a Kanban board, reviews statistics, and works with roles: Admin, Seller, and Viewer.

This explanation can be read without signing in. CRM access still asks for email and password. There is no public signup.

## 4. Capturas

Unas pocas imágenes estáticas, con pie. Solo datos ficticios: asesorías inventadas, correos `example.com`, cifras inventadas. Nunca un lead real ni datos personales.

Tema claro como mínimo. Cada imagen lleva texto alternativo que describe la pantalla, no la palabra «captura».

| # | Archivo previsto | Pie (ES) | Caption (EN) | Alt (ES) | Alt (EN) |
| --- | --- | --- | --- | --- | --- |
| 1 | `public/what-it-is/leads-light.webp` | **Lista de leads.** Empresas ficticias, con filtro y estado. No son clientes reales. | **Lead list.** Fictional companies, with a filter and a status. They are not real clients. | Lista de leads en tema claro: tres asesorías ficticias con estado y ciudad de ejemplo. | Light-theme lead list: three fictional advisory firms with sample status and city. |
| 2 | `public/what-it-is/kanban-light.webp` | **Kanban.** Los nueve estados del pipeline, de Nuevo a Cliente o Descartado, con tarjetas de ejemplo. | **Kanban.** The nine pipeline states, from Nuevo to Cliente or Descartado, with sample cards. | Tablero Kanban en tema claro con columnas del pipeline y tarjetas de empresas ficticias. | Light-theme Kanban board with pipeline columns and cards for fictional companies. |
| 3 | `public/what-it-is/stats-light.webp` | **Estadísticas.** Volumen y distribución del pipeline. Cifras inventadas. | **Statistics.** Pipeline volume and distribution. Invented figures. | Página de estadísticas en tema claro: gráfico de barras con cifras ficticias del pipeline. | Light-theme statistics page: a bar chart with fictional pipeline figures. |
| 4 | `public/what-it-is/detail-light.webp` | **Detalle de un lead.** Análisis de dolores (evidencia, inferencia y especulación) de una asesoría inventada. | **Lead detail.** Pain analysis (evidence, inference, and speculation) for an invented firm. | Panel de un lead ficticio en tema claro, con el bloque de análisis de dolores visible. | Light-theme panel for a fictional lead, with the pain-analysis block visible. |

Los nombres de estado del pipeline se quedan en español en los pies: son los valores canónicos del producto. El slice de i18n traduce las etiquetas de la UI; no renombra el enum.

Ruta: `public/what-it-is/`. Imágenes optimizadas y estáticas (peso contenido, formato moderno). No salen de Supabase ni de una petición autenticada.

## 5. Requisitos de la página

- Visible sin iniciar sesión, en la misma ruta de login.
- No retrasa el formulario: la sección no hace fetch de datos ni de auth; las imágenes no bloquean que el formulario se pueda usar. Cargarlas en diferido si van debajo del pliegue.
- Tema claro como mínimo, con el alt de la tabla.
- Sin cookie de visitante, sin `DEMO_*` y sin cliente de Supabase para pintar la sección.

## 6. Trabajo de este slice (cuando se implemente)

Hoy ninguno de estos puntos está hecho.

1. Quitar el botón de la demo, la ruta y la cookie de sesión de visitante, el manejo de `DEMO_*` y los tests de la demo.
2. Quitar `DEMO_SESSION_SECRET` y `DEMO_MODE_ENABLED` de la documentación de comportamiento actual y de `.env.example`.
3. Añadir la sección Qué es y sus capturas.
4. Actualizar los E2E de la página de login (`tests/e2e/visitor-demo.spec.ts` deja de describir una sesión de visitante).

## 7. Criterios de aceptación

Comprobables cuando exista implementación. Hoy ninguno se cumple.

1. `src/app/login/page.tsx` muestra la sección sin sesión. El título visible por defecto es «Qué es». La copia inglesa «What it is» está en el repositorio, igual que el cuerpo de la sección 3.
2. No existe el botón «Entrar como visitante». No existen `POST /api/demo/enter` ni `POST /api/demo/exit`. No se emite la cookie `gdw_visitor`. `DemoLeadRepository` no está en el camino de `getSessionLeadRepository()`.
3. `DEMO_MODE_ENABLED` y `DEMO_SESSION_SECRET` no se leen. No están en `.env.example` ni en la guía de operación como configuración vigente.
4. Las cuatro imágenes están en `public/what-it-is/`, son estáticas, de tema claro, con datos ficticios, pie y alt de la sección 4.
5. Con la red de imágenes bloqueada o lenta, el formulario de login sigue pudiendo enviarse. La sección no llama a Supabase.
6. El E2E del login cubre la sección y no define `DEMO_MODE_ENABLED` ni `DEMO_SESSION_SECRET`.

## 8. Fuera de este slice

- Selector de idioma de toda la app, catálogos y correos: [`i18n.es.md`](./i18n.es.md).
- Tema oscuro de las capturas. El claro es el mínimo; el oscuro puede añadirse luego.
- Idioma del texto que genera el análisis IA. Sigue abierto y no bloquea esta sección: la captura 4 usa un análisis ya escrito, ficticio, no una llamada al modelo.
