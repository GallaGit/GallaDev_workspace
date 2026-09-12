# Guía de instalación y uso

## Requisitos

- Node.js 20 o superior.
- npm.
- Una integración de Notion con acceso a la base `Leads Asesorías Valencia`.
- El token interno de esa integración.

La aplicación se ejecuta localmente y no necesita una cuenta propia.

## Instalación

Desde la raíz del repositorio:

```bash
npm install
cp .env.example .env.local
```

En PowerShell, el último comando es:

```powershell
Copy-Item .env.example .env.local
```

Edita `.env.local` y configura, como mínimo:

```dotenv
NOTION_TOKEN=secret_xxxxxxxxx
NOTION_DATABASE_ID=ed07cdd4c5424f9a8b8ebd73e358c6cd
NOTION_DATA_SOURCE_ID=27fefc608dfd43569465582d3c49d99f
AUTH_DISABLED=true
```

No copies tokens en código, commits, capturas o documentación.

## Permisos de Notion

La integración debe tener acceso a `Leads Asesorías Valencia` y capacidades para:

- leer contenido;
- actualizar contenido;
- insertar bloques;
- crear comentarios, si se quiere el historial duplicado en comentarios.

Si los comentarios no están autorizados, las actualizaciones principales continúan y la actividad sigue guardándose en bloques.

## Arranque

```bash
npm run dev
```

Abre:

- Leads_CRM: [http://localhost:3000](http://localhost:3000)
- gestión de leads: [http://localhost:3000/leads](http://localhost:3000/leads)

Para comprobar una compilación de producción:

```bash
npm run build
npm start
```

## Primer uso

1. Abre `/leads`.
2. La aplicación intentará sincronizar automáticamente.
3. Comprueba el indicador de sincronización en la barra superior.
4. Si es necesario, pulsa **Sincronizar**.
5. Selecciona un lead para abrir el panel derecho.
6. Para alta manual, pulsa **Nuevo lead**, completa el formulario y guarda.

Si aparece `NOTION_TOKEN no configurado`, revisa `.env.local` y reinicia `npm run dev`.

## Trabajo diario

### Daily Work

En `/inbox` verás las colas del día:

- **Nuevos y pendientes** — estado `Nuevo` o `Pendiente revisar` (los leads de n8n entran en `Nuevo`);
- faltan datos, emails listos (incluye borrador en `Nuevo`), follow-ups vencidos, posibles duplicados.

Al abrir una cola se aplica el filtro en Leads y se abre el primer lead.

### Kanban

En `/kanban` arrastra tarjetas entre las 9 columnas de estado. El cambio se guarda en Notion.

### Email

En `/email` revisa borradores: edita, copia, marca como **Email preparado** o aplica la plantilla `outreach-v1` si el cuerpo está vacío (pide confirmación si no lo está). El botón **Redactar email** abre Gmail Compose con destinatario, asunto y cuerpo listos para revisar y enviar.

### Crear lead manual

En `/leads`, el botón **Nuevo lead** abre un formulario modal.

- Obligatorios: **Empresa** y al menos un canal de contacto (**correo general**, **teléfono** o **web**).
- El lead se crea en Notion con estado `Nuevo` y origen `Manual`.
- Si el sistema detecta un posible duplicado (mismo email, teléfono o dominio), avisa y pide confirmación antes de crear.
- Tras crear, se abre el panel del lead nuevo.

### Buscar

El buscador combina:

- nombre de empresa;
- web y dominio;
- email general;
- ciudad;
- provincia;
- LinkedIn.

La búsqueda no modifica Notion.

### Filtrar

Los filtros se combinan con lógica AND:

- estado;
- provincia;
- ciudad normalizada;
- número mínimo/máximo de empleados;
- fecha de creación;
- última actividad;
- presencia de email;
- presencia de teléfono;
- presencia de web;
- presencia de LinkedIn;
- favorito.

Ejemplo:

```text
Provincia = Valencia
Y Empleados >= 3
Y Empleados <= 10
Y Estado = Nuevo
Y Con email
```

(El filtro operativo de n8n es 3–10; el ICP estratégico de negocio sigue siendo 5–30.)

Pulsa **Limpiar** para quitar todos los filtros.

### Personalizar columnas

Los checkboxes de la barra de columnas muestran u ocultan campos. La configuración se guarda en el navegador.

### Abrir un lead

Haz clic en una fila. La URL se actualiza a:

```text
/leads?lead=<notion-page-id>
```

Ese enlace conserva el lead abierto al refrescar o compartir la ruta dentro del mismo entorno local.

### Cambiar estado

El estado puede cambiarse:

- inline desde la tabla;
- desde el panel derecho;
- de forma masiva tras seleccionar filas.

El cambio se persiste en Notion y registra actividad.

### Notas

1. Edita el campo en el panel.
2. Pulsa **Guardar notas**.
3. Hasta 2000 caracteres se guardan en `Observaciones`.
4. El excedente se guarda bajo `Notas` en el cuerpo de la página.

La UI avisa desde aproximadamente 1800 caracteres. Nunca se trunca texto en silencio.

### Email

El borrador se muestra como texto plano:

- los `<br>` históricos se convierten en saltos de línea;
- `\[Nombre\]` se presenta como `[Nombre]`;
- se elimina HTML residual básico.

Puedes editar asunto y cuerpo, guardarlos, copiarlos o guardarlos y marcar el lead como **Email preparado**.

### Favorito

La estrella de la tabla o del drawer actualiza la propiedad `Favorito` de Notion.

### Detectar dolores

En el panel del lead, **Detectar dolores** (después de Favorito) llama a Groq con los datos del registro y guarda el resultado en la propiedad Notion `Análisis IA`.

- El texto se separa en **Evidencia**, **Inferencia** y **Especulación**. La evidencia solo usa hechos del lead; no inventa webs, cifras ni software.
- Puedes repetir la acción; sobrescribe el análisis anterior (sin confirmación en v1).
- Requiere API key de Groq en Settings. Un error de Groq no modifica el lead.
- Si la automatización *Lead analizado* está activa y tiene webhook, se notifica a n8n en segundo plano.

La sección **Dolores** está debajo de CRM y encima de Notas.

### Acciones externas

El drawer permite:

- abrir la web;
- abrir LinkedIn;
- buscar la dirección en Google Maps;
- abrir el cliente de correo;
- copiar email;
- copiar teléfono.

### Archivar

“Archivar” no elimina de forma permanente. Establece la página como archivada en Notion tras una confirmación.

La acción está disponible para un lead individual y para una selección.

### Duplicados

En `/duplicates` se listan grupos con el mismo email, teléfono o dominio web (también nombre o dirección normalizados; incluye archivados). Daily Work enlaza la cola de posibles duplicados hacia Leads; la fusión se hace aquí.

1. Elige un lead para **Conservar** y otro para **Archivar**.
2. Compara los campos lado a lado.
3. **Fusionar** rellena solo los campos vacíos del lead conservado y archiva el otro. Nunca sobrescribe valores existentes. Requiere confirmación.
4. **Solo archivar origen** archiva el lead marcado sin copiar campos.

Al fusionar o archivar, la lista de grupos se actualiza.

## Operaciones masivas

1. Selecciona una o más filas.
2. Usa la barra que aparece sobre la tabla.
3. Elige:
   - cambiar estado;
   - marcar favorito;
   - archivar.

Las actualizaciones se procesan secuencialmente contra Notion para reducir errores por límites de API.

## Settings e integraciones

En `/settings` puedes revisar y completar Notion, n8n, IA (Groq) y SerpAPI.

- Los secretos se muestran enmascarados (últimos 4 caracteres).
- **Guardar** escribe un override en `data/settings.local.json` (fuera de Git). No hace falta reiniciar el servidor.
- **Probar conexión** valida sin devolver el secreto.
- `.env.local` sigue siendo el valor de arranque; el archivo local gana si existe override.
- **Restablecer a .env** (cuando el valor viene del archivo) elimina el override al guardar.

## Automations

En `/automations` hay tres eventos reservados: Nuevo Lead, Lead actualizado y Lead analizado. La capa HTTP está lista, pero **en v1 el workflow de captación no tiene esos triggers**.

- La captación se lanza en n8n (Manual o semanal), no desde Leads_CRM.
- No actives los toggles ni pegues URLs en v1.
- Si en una fase posterior hubiera endpoint, **Probar** enviaría un payload de ejemplo; con toggle activo el alta/edición también dispararía (best-effort; un error de n8n no impide guardar en Notion).

## Tema

El botón de la esquina superior cambia entre tema claro y oscuro. El diseño está optimizado principalmente para escritorio y tablet.

## Estado de las demás secciones

Statistics (`/stats`) y Duplicados (`/duplicates`, merge incluido) están operativos. Settings permite guardar y probar integraciones (secretos enmascarados). Automations muestra la capa de webhooks n8n (sin trigger en el workflow en v1). Si hay toggle activo y URL, la app dispara en alta, edición y análisis de dolores (best-effort). Consulta [`ESTADO_IMPLEMENTACION.md`](./ESTADO_IMPLEMENTACION.md).

## Diagnóstico rápido

### No aparecen leads

- verifica `NOTION_TOKEN`;
- verifica `NOTION_DATA_SOURCE_ID`;
- comparte la base con la integración;
- reinicia el servidor después de cambiar `.env.local`;
- pulsa **Sincronizar** y lee el error mostrado.

### Error al editar

- comprueba que la integración tenga capacidad de actualización;
- comprueba que los nombres y tipos de propiedades coincidan con [`INTEGRACIONES.md`](./INTEGRACIONES.md);
- confirma que `Estado` conserve exactamente los 9 valores vigentes.

### La actividad no aparece

- abre un lead y realiza una acción significativa;
- comprueba que la integración pueda insertar bloques;
- revisa que el cuerpo de la página no haya cambiado manualmente los encabezados `Actividad` o `Notas`.

### n8n muestra “Sin webhook”

Es el comportamiento esperado en v1: no hay endpoints de webhook en el workflow de captación. No configures `N8N_WEBHOOK_LEAD_*` hasta una fase posterior. Para probar la conexión del servicio usa Settings → n8n → **Probar conexión** (`N8N_BASE_URL`).

## Calidad

Antes de entregar cambios:

```bash
npm run lint
npm run build
```
