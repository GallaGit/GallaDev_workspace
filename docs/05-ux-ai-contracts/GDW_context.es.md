# Contratos UX Y De IA

## Objetivo del análisis de dolores

La acción `Detectar dolores` analiza un lead con Groq y guarda el resultado en `Análisis IA`. La función es best-effort desde el punto de vista de automatizaciones: un fallo del webhook no debe cambiar el resultado de persistencia.

## Estados de la UI

El drawer debe comunicar los estados idle, loading, vacío, éxito y error. La acción sigue disponible después de un resultado anterior para poder repetirla. El resultado se muestra debajo de la información CRM y encima de las notas.

## Contrato del análisis

La respuesta se organiza en:

- **Evidencia:** hechos presentes en los datos del lead.
- **Inferencia:** conclusiones razonables derivadas de esos hechos.
- **Especulación:** hipótesis que necesitan validación.

El modelo no debe inventar webs, cifras, software, información de clientes ni otros hechos. Un error de Groq no debe modificar el lead. El análisis existente solo se sobrescribe después de completar correctamente uno nuevo.

## Endpoints y persistencia

- `POST /api/leads/:id/analyze` es el endpoint canónico.
- El alias histórico de pain-analysis solo debe mantenerse donde la aplicación ya lo soporte.
- El resultado se persiste en `Análisis IA`.
- La automatización opcional `lead_analyzed` se notifica de forma asíncrona.
