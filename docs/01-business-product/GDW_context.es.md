# Contexto De Negocio Y Producto

## Producto

GallaDev Workspace ayuda a asesorías y gestorías a descubrir, cualificar y hacer seguimiento de prospectos. Sigue siendo un único producto y repositorio mientras evoluciona desde un workspace individual hacia SaaS.

## Decisión estratégica

El SaaS se construirá sobre este proyecto, no sobre una copia paralela. Las ramas Git y los entornos Supabase/Vercel separados aíslan trabajo y datos sin duplicar el código. La secuencia es M1 Seguro, validación SaaS mínima, M2 Sólido y M3 SaaS comercial.

## Pipeline

El pipeline canónico tiene nueve estados:

1. `Nuevo`
2. `Pendiente revisar`
3. `Validado`
4. `Email preparado`
5. `Email enviado`
6. `Respondió`
7. `Reunión`
8. `Cliente`
9. `Descartado`

Estos nombres se comparten en listas, Kanban, filtros, KPIs y Daily Work. Los leads nuevos entran en `Nuevo`, vengan de n8n, del formulario público o de un alta manual. `Origen` identifica la fuente.

## Reglas de producto

- n8n es un proveedor de captación opcional e intercambiable.
- En la UI del producto no hay campo de tags.
- Un lead tiene responsable (`Lead.responsibleId`, columna `responsable`). El desplegable del panel lista el equipo desde `GET /api/team` si el usuario es Admin; el resto de quien puede escribir se asigna a sí mismo (**Yo**). La lista de leads tiene el filtro **Mis leads** sobre el id del usuario con sesión.
- Los favoritos se persisten con el lead.
- Borrar significa archivar, no eliminar de forma destructiva.
- El merge solo rellena campos vacíos del lead conservado y archiva el otro.
- La interfaz de usuario permanece en español.
- El análisis IA se guarda en `Análisis IA` y distingue evidencia, inferencia y especulación.
- El ICP estratégico es de 5–30 empleados; el filtro operativo actual de n8n es de 3–10.

## Puerta de validación SaaS

No hay alta pública. Un Admin crea cada cuenta en el Dashboard de Supabase (Authentication → Users); `on_auth_user_created` asigna Seller, y el Admin se marca en `profiles.role`. Una demo de visitante sin contraseña (apagada por defecto) puede mostrar leads ficticios de solo lectura sin sesión de Supabase.

El hito SaaS mínimo se valida cuando un segundo usuario puede completar el flujo real `login -> leads -> Kanban -> email -> cambio de estado`, mientras los controles de acceso por fila impiden leer o modificar datos de otros usuarios. Billing y las capacidades de escala vienen después.
