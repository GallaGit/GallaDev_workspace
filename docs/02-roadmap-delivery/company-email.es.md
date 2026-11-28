# Email De Empresa (galladev.com) — Módulo Correo en GDW

> **Estado:** implementado (Fases 1–3 + dual mailbox V1) · **Decisión:** Ociel, 29 Sep 2026 · **Implementado:** 30 Sep 2026 · **Dual mailbox:** 30 Sep 2026.
> Sustituye la recomendación del 27 Sep 2026 (Cloudflare Email Routing más «Enviar como» en Gmail, y las alternativas Google Workspace / Zoho). Ese camino no es el plan. Sin Gmail. Sin Google Workspace.
> `hola@galladev.com` y `ociel@galladev.com` reciben y envían correo a través de Resend. El módulo Correo (`/correo`) es un inbox unificado con filtro por buzón. EN: [`company-email.md`](./company-email.md).

Va por delante de la sección «¿Qué es?» del login y de los pendientes de M2 (CodeQL, E2E de Viewer 403, rate limit distribuido, historial de auditoría y la limpieza de mocks de Notion en `tests/mocks/handlers.ts`).

## 1. Decisión

Allowlist de producto: `hola@galladev.com` (empresa) y `ociel@galladev.com` (personal). No hay catch-all. Ningún otro local-part (`contacto@`, `facturas@`, etc.) es un buzón.

La entrada y la salida pasan por Resend. La entrada es [Resend Inbound](https://resend.com/docs/dashboard/receiving/introduction) (receiving): un registro MX en `galladev.com` que apunta a Resend, y Resend manda un webhook por cada correo recibido.

El buzón es el módulo **Correo** dentro de GDW (`/correo`). Reutiliza auth, RBAC y Supabase. No es una app aparte. Los borradores desde la ficha del lead se guardan en `email_drafts` y se ven en `/correo/borradores`. `/email` redirige ahí de forma permanente.

V1 UI: un solo inbox unificado, filtro `Todos | hola@ | ociel@`, chip por hilo, reply From = `mailbox_address` del hilo, botón **Nuevo** (compose vía Resend) y pill **Borradores** (`email_drafts`). Sin carpetas Entrada/Enviados/Spam. Sin Gmail.

| Tema | Decisión |
| --- | --- |
| Direcciones | `hola@galladev.com` y `ociel@galladev.com`. |
| Catch-all | No. |
| Proveedores descartados | Gmail, Google Workspace, Cloudflare Email Routing, Zoho. |
| Transporte | Resend para entrada y salida. |
| Producto | Módulo Correo en GDW (`/correo`), inbox unificado + filtro. |

El MX de recepción de Resend acepta cualquier local-part del dominio ([dominios propios](https://resend.com/docs/dashboard/receiving/custom-domains)). La regla de producto es la allowlist. El webhook guarda un mensaje solo cuando `to`, `cc` o `bcc` incluye `hola@` u `ociel@`. Cualquier otro destinatario no se guarda. El manejador igual responde éxito tras una firma válida.

## 2. Estado actual

Hechos al 27 Sep 2026, vigentes el 29 Sep 2026. Sin valores de secretos.

| Pieza | Hecho |
| --- | --- |
| Dominio | `galladev.com`. DNS en Cloudflare. |
| Web | Apex y `www` en Proxied (nube naranja). No tocarlos. |
| Resend | Dominio `galladev.com` **Verified** el 18 Sep 2026. Envío y recepción activos. Inbound habilitado el 30 Sep 2026. |
| Envío | Landing → `POST /api/ingest/lead` en `workspace.galladev.com` (Vercel) → Resend. Acuse al visitante y aviso interno. Remitente `hola@galladev.com`. Aviso a `ociel.galla@gmail.com`. E2E de ese envío pasado el 18 Sep. |
| Vercel | Están `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO`, `RESEND_API_KEY` y `RESEND_INBOUND_WEBHOOK_SECRET`. |
| Código | `EMAIL_REPLY_TO`, si está definida, sale como Reply-To (`src/lib/email/resend-client.ts`, `send-ingest-emails.ts`). No consta entre las variables de Vercel de arriba. |
| Buzón | `/correo` recibe en `hola@` y `ociel@` (allowlist). Columna `email_threads.mailbox_address`. Filtro UI + chip. Reply From = buzón del hilo. Dual mailbox V1, 30 Sep 2026. Compose + borradores de mensajes nuevos (`email_drafts`, botón Nuevo), 30 Sep 2026. |
| Apex MX | MX publicado en Cloudflare (apex, DNS-only) apuntando a Resend inbound. |
| Storage | El repo no usa Supabase Storage. No hay buckets. La spec del portal de cliente propone un bucket privado `project-files`; no está creado. |
| `/email` | Redirección permanente a `/correo/borradores`. |

Registros DNS de correo que hay que dejar quietos (DNS-only, no Proxied):

| Tipo | Nombre | Destino o valor | Papel |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | (DKIM de Resend; no se copia el valor aquí) | DKIM de Resend |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | Resend |
| CNAME | `send` | `send.forge.rmta.net` | Return-path de Resend |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC, política `none` |

El SPF de Resend vive en `send`, no en el apex. No añadir un segundo SPF en el apex. No borrar `resend._domainkey`, `send`, `rsend` ni `_dmarc`: el acuse y el aviso interno dejarían de autenticarse.

## 3. Entrada en Resend (docs consultadas el 29 Sep 2026)

Fuentes: [Receiving](https://resend.com/docs/dashboard/receiving/introduction), [dominios propios](https://resend.com/docs/dashboard/receiving/custom-domains), [DNS en Cloudflare](https://resend.com/docs/dashboard/domains/cloudflare), [`email.received`](https://resend.com/docs/webhooks/emails/received), [verificar webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests), [contenido del correo](https://resend.com/docs/dashboard/receiving/get-email-content), [adjuntos](https://resend.com/docs/dashboard/receiving/attachments), [respuesta en el hilo](https://resend.com/docs/dashboard/receiving/reply-to-emails).

**MX.** En el dominio verificado, activar receiving. Resend muestra el host MX y la prioridad que hay que publicar. Ociel añade ese registro en el DNS de Cloudflare desde su PC en la UE. El apex no tiene MX hoy, así que el registro va en `galladev.com` (apex), DNS-only (nube gris), no Proxied. La guía de Cloudflare de Resend (misma fecha) muestra la forma: tipo `MX`, prioridad `10`, servidor de correo copiado del panel (el ejemplo de la guía es `inbound-smtp.us-east-1.amazonaws.com`). Vale el valor del panel; no se inventa la región. Un solo MX. No combinarlo con Cloudflare Email Routing ni con el MX de otro proveedor.

**Evento del webhook.** `email.received`. Resend hace un `POST` por cada correo recibido. El cuerpo es metadatos: `data.email_id` (id de Resend para ese correo), `data.message_id` (el `Message-ID` RFC), `from`, `to`, `cc`, `bcc`, `subject` y metadatos de adjuntos (`id`, `filename`, `content_type`). No incluye el cuerpo HTML, el cuerpo en texto, las cabeceras ni los bytes de los adjuntos.

**Firma.** Svix. Hay que leer el cuerpo crudo de la petición antes de cualquier parseo JSON. Se verifica con `resend.webhooks.verify`, pasando esa cadena cruda, las cabeceras `svix-id`, `svix-timestamp` y `svix-signature`, y el secreto de firma. Una firma mala o ausente se rechaza (no se guarda). El secreto no se commitea.

**Cuerpo y ficheros.** Tras un `email.received` verificado, el mensaje se carga con la Receiving API (`resend.emails.receiving.get(email_id)`) y los bytes de los adjuntos con la Attachments API. `download_url` caduca (alrededor de una hora; respetar `expires_at`). La clave de idempotencia es el id de mensaje del proveedor, `data.email_id`. También se guarda `message_id`: las respuestas lo necesitan para el hilo.

## 4. Variables de entorno

Solo nombres. Los valores viven en Vercel (y en Resend). Nunca en git, nunca en este documento.

| Nombre | Uso |
| --- | --- |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Secreto de firma del webhook de entrada. Los ejemplos de Resend llaman al mismo tipo de secreto `RESEND_WEBHOOK_SECRET`. Esta spec usa `RESEND_INBOUND_WEBHOOK_SECRET` para no mezclarlo con un webhook futuro de eventos de envío. |
| `RESEND_API_KEY` | Clave de Resend con **full access**. Hace falta para enviar y para la Receiving API (`GET /emails/receiving/{id}`: cuerpo HTML/texto y cabeceras). Una clave solo `sending_access` responde 401 al leer recibidos y los cuerpos quedan vacíos. Se puede usar una clave dedicada full access en Vercel con el mismo nombre; no se commitea. |

`EMAIL_FROM_CLIENTS` y `EMAIL_NOTIFY_TO` se quedan como están. Son el envío transaccional que ya existe, no el buzón.

### Relleno de cuerpos (Fase 0)

Si hubo mensajes guardados sin cuerpo (p. ej. clave sin permiso de lectura), tras poner una `RESEND_API_KEY` full access y redesplegar, un Admin puede rellenar los cuerpos desde Resend (retención ~30 días):

```bash
# Sesión Admin (cookie de la app). Opcional: {"limit":100} (1–500).
curl -X POST "https://workspace.galladev.com/api/email/backfill-bodies" \
  -H "Content-Type: application/json" \
  -H "Cookie: <sesión-admin>" \
  -d '{"limit":100}'
```

La ruta exige `requireAdmin`, es idempotente (solo filas inbound con `body_html` y `body_text` null) y responde `{ ok, scanned, updated, skipped, failed }`. Repetir hasta `scanned: 0` o `updated: 0` con `failed` estable. No registra cuerpos ni direcciones.

### Re-hilar hilos partidos

**Causa.** Resend (SES) reescribe la cabecera `Message-ID` que mandamos. El destinatario ve `<…@eu-west-1.amazonses.com>` y su respuesta lleva ese id en `In-Reply-To`/`References`, pero guardábamos nuestro `<uuid@galladev.com>`, así que no había coincidencia y se creaba un hilo nuevo. Desde este cambio, tras cada envío (respuesta, compose, reenvío) se lee el `message_id` real con `emails.get` y es el que se guarda. El matcher de entrada (`thread-match.ts`) prueba `In-Reply-To`, luego cualquier id de `References` (con o sin `<>`, cabeceras plegadas) y, si el mensaje parece respuesta (cabeceras de hilo o prefijo `Re:`/`Fwd:`/`RV:`…), el asunto normalizado + misma contraparte en el mismo buzón en los últimos 30 días.

Para arreglar los hilos que ya se partieron, desde una pestaña de GDW con sesión Admin, en la consola del navegador:

```js
// 1) Simulación: no escribe nada, lista qué fusionaría.
await (await fetch("/api/email/rethread", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dryRun: true }),
})).json();

// 2) Aplicar.
await (await fetch("/api/email/rethread", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dryRun: false }),
})).json();
```

Responde `{ ok, dryRun, outboundIdsFixed, threadsScanned, merged: [{ from, into, via, messages }] }`. Corrige primero los `message_id` salientes guardados con nuestro id (consulta a Resend, retención ~30 días) y luego mueve los mensajes del hilo nuevo al hilo original y borra el hilo vacío (conserva `lead_id`; queda no leído si alguno lo estaba). `requireAdmin`, límite 3/min, idempotente: repetirlo devuelve `merged: []`. Opcional `limit` (1–1000, defecto 500).

### Adjuntos (descarga)

`GET /api/email/attachments/[id]` (UUID de `email_attachments`, solo Admin) pide a Resend una URL firmada temporal (`emails.receiving.attachments.get` o `emails.attachments.get` si el mensaje es saliente) y la devuelve en JSON. No hace proxy del fichero ni expone la API key. Si Resend ya no tiene el correo (~30 días), responde 410. La vista de hilo abre PDF/imagen en pestaña nueva y descarga el resto.

## 5. Fases

Las tres fases están implementadas (PR #65, 30 Sep 2026). DNS, webhook, migración SQL y variables de entorno configurados.

### Fase 1 — Recibir

**Alcance.** Activar Resend inbound para `hola@galladev.com`. Ociel publica el MX en Cloudflare. Una ruta de Next.js verifica el webhook y guarda el mensaje.

Ruta: `src/app/api/email/inbound/route.ts` (el App Router vive bajo `src/app`; la forma es `app/api/email/inbound/route.ts`).

- Rechazar lo que no sea un evento `email.received` verificado.
- Conservar solo el correo para la allowlist (`hola@` u `ociel@`). Ninguna fila de catch-all. Persistencia de `mailbox_address` en el hilo (`src/lib/email/mailboxes.ts`).
- Idempotente por `data.email_id`. Una entrega repetida no cambia nada y responde éxito.
- Persistir hilos y mensajes en Supabase, por ejemplo las tablas `email_threads` y `email_messages`.
- Adjuntos: metadatos siempre. Los bytes van a un bucket privado de Storage cuando exista uno. En el repo hoy no hay ninguno (el `project-files` de la spec del portal de cliente no está creado). Hasta que haya bucket, solo metadatos. No inventar un bucket público. Tope de 50 MB por fichero (52 428 800 bytes), el mismo tope que la spec del portal de cliente.
- El webhook no tiene sesión de usuario. La ruta escribe con la credencial de servidor después de comprobar la firma. Las lecturas pasan por el usuario con sesión y por RLS. Solo los roles permitidos leen. Admin es el rol permitido hasta que se responda la pregunta abierta de la sección 7.
- Rate limit en la ruta. El limitador de la app hoy es en memoria y por instancia; esta ruta igual necesita un tope para que una ráfaga no llene la tabla.

**Aceptación.**

- [x] Receiving de Resend activo en `galladev.com`, y el MX del apex es el único registro que mostró Resend, DNS-only.
- [x] `send`, `rsend`, DKIM y `_dmarc` iguales. El acuse del formulario sigue saliendo.
- [x] Un `POST` a la ruta de entrada con firma Svix mala o ausente no escribe ninguna fila. (test: `inbound-route.test.ts`)
- [x] Un mensaje real a `hola@galladev.com` se guarda una vez. Una segunda entrega del mismo `email_id` no inserta otro mensaje. (idempotencia por `resend_email_id` UNIQUE)
- [x] Un mensaje a cualquier otra dirección `@galladev.com` (fuera de la allowlist) no se guarda. (test: `inbound-verify.test.ts`)
- [x] Un mensaje a `ociel@galladev.com` se guarda con `mailbox_address = ociel@…`. (allowlist dual; tests `mailboxes.test.ts`, `inbound-verify.test.ts`)
- [x] RLS: una sesión Admin puede leer la fila; un rol no permitido, no. Ningún secreto en git. (`email_threads_admin_read` policy)

### Fase 2 — UI del buzón

**Alcance.** `/correo` dentro de GDW: lista de hilos, vista del hilo, leído y no leído, y un modo de enlazar un hilo con un lead. Usa la sesión y el RBAC que ya existen. El acceso es Admin y Seller. Viewer y la demo de visitante no ven el buzón (la demo ya redirige `/email` y `/correo` a `/leads`).

**Aceptación.**

- [x] Un Admin abre `/correo`, ve los hilos (filtro Todos / hola@ / ociel@), abre uno, y el marcador de no leído se quita al leer el hilo. (`InboxPage`, chip, `ThreadView`)
- [x] El Admin puede enganchar un hilo a un lead existente, y el enlace sigue ahí al recargar. (`LinkLeadDialog`, `PATCH /api/email/threads/[id]`)
- [x] Un usuario sin sesión, una sesión de demo de visitante y un rol no permitido no obtienen la lista de hilos ni los cuerpos. (`gate.ts` bloquea `/correo` y `/api/email/threads`; RLS Admin-only)
- [x] El HTML del mensaje se sanea en servidor al guardarlo y al servirlo (`sanitize-html` en `src/lib/email/sanitize-email-html.ts`). La vista lo pinta en un iframe con `sandbox` sin scripts. Las imágenes remotas no se cargan.

### Fase 3 — Responder

**Alcance.** Desde el hilo abierto, un usuario permitido responde por Resend como el `mailbox_address` del hilo (`hola@` u `ociel@`). El hilo sigue la guía de respuesta de Resend: `In-Reply-To` es el `message_id` al que se contesta, y `References` son los `message_id` anteriores del hilo más ese, separados por espacios. El asunto mantiene el hilo (`Re:` más el asunto). El mensaje saliente se guarda en la misma fila de `email_threads`, con su id de Resend, para que una respuesta entrante posterior se una al mismo hilo.

**Aceptación.**

- [x] La respuesta sale como el mailbox del hilo por Resend (`GallaDev <hola@…>` u `Ociel <ociel@…>`), y SPF, DKIM y DMARC siguen pasando. (`send-reply.ts`, test: `send-reply.test.ts`)
- [x] El payload enviado incluye `In-Reply-To` y `References` construidos con los `message_id` guardados del hilo. (test: `send-reply.test.ts`)
- [x] La respuesta se ve en ese hilo en `/correo` después de enviarla, y un envío fallido queda marcado como fallido en vez de desaparecer. (`send_status` column: `delivered` / `failed`)
- [x] Un seguimiento desde fuera hacia ese hilo se guarda en el mismo hilo, no como uno nuevo, cuando el `message_id` / `References` entrante coincide. (`findOrCreateThread` en `inbound-store.ts`, `thread-match.ts`; se guarda el `message_id` real de Resend tras enviar, ver «Re-hilar hilos partidos»)
- [x] Responder a todos: To = remitente + To del último mensaje, Cc = su Cc, sin nuestros buzones. (`replyAllRecipients`, test: `threading.test.ts`, `send-reply.test.ts`)
- [x] Reenviar: `POST /api/email/threads/[id]/forward` con el último mensaje citado y sus adjuntos (URL firmada de Resend como `path`); si un adjunto ya no existe, nota con el nombre. Se guarda en el mismo hilo. (`send-forward.ts`)
- [x] Borradores de respuesta por hilo: autoguardado, se restauran al abrir el hilo y se borran al enviar. `email_drafts.thread_id` (migración `20261010120000_email_reply_drafts.sql`).
- [x] Cc/Cco, firma por buzón y adjuntos salientes también en responder y reenviar (ver «Redactar: Cc/Cco, autoguardado, firma y adjuntos»).

### Redactar: Cc/Cco, autoguardado, firma y adjuntos (19 Nov 2026)

Migración `20261119160000_email_compose_cc_signatures.sql` (**aplicar a mano antes de desplegar**): añade `email_drafts.cc_address` / `bcc_address` (texto, vacío por defecto) y crea `email_mailbox_signatures` (una fila por buzón, firma de hasta 2000 caracteres; RLS con FORCE, solo Admin). No hay variables de entorno nuevas.

- **Cc/Cco.** Campos múltiples en Nuevo mensaje y en Responder/Reenviar (botón «CC / CCO»). Se normalizan (`Nombre <a@b.com>` → `a@b.com`), se deduplican entre To/Cc/Cco (To gana, luego Cc) y se validan: máx. 20 por campo y 50 en total. Salen por Resend como `cc` / `bcc` y se guardan en `email_messages.cc_addresses` / `bcc_addresses`. El Cco solo se muestra en los mensajes salientes. Helpers: `src/lib/email/recipients.ts`. Un destinatario no válido responde 400 sin enviar nada (`invalid-cc` / `invalid-bcc`).
- **Autoguardado.** El diálogo de Nuevo mensaje guarda el borrador ~2 s después de dejar de escribir con `POST /api/email/drafts` (la misma API). Las guardas van en serie para no duplicar borradores, se vacía la cola al cerrar y no se resucita un borrador ya enviado. Indicador «Guardando… / Guardado / Error al guardar». Un borrador que solo contiene la firma no se guarda.
- **Firma por buzón.** El Admin la edita en Ajustes → «Firmas de correo» (`GET`/`PUT /api/email/signatures`, solo Admin, RLS). Al redactar se añade al cuerpo como bloque `-- ` al final, y es editable antes de enviar. Si se cambia el buzón de origen y el texto no se tocó, se cambia la firma. Un borrador restaurado no recibe firma. Helpers: `src/lib/email/signature.ts`.
- **Adjuntos salientes.** Selector en el diálogo y en responder/reenviar. Límites (caben en los 4,5 MB de cuerpo de Vercel): 10 ficheros, 3 MiB por fichero y 3,5 MiB en total; se bloquean extensiones ejecutables (`.exe`, `.bat`, `.js`, `.sh`, …). Si no hay adjuntos, el cliente sigue enviando JSON; con adjuntos envía `multipart/form-data` (`payload` + `files`) a las mismas rutas (`outbound-client.ts`, `outbound-request.ts`). Resend los recibe como `attachments`. Persistencia: con `EMAIL_ATTACHMENTS_BUCKET` los bytes van al bucket con la misma ruta opaca que los entrantes (`email/{message_id}/{attachment_id}`) y se sirven por `/api/email/attachments/[id]/file`; sin bucket funciona igual, se guardan solo los metadatos y, si Resend lo permite, el id del adjunto para descargarlo ~30 días. La persistencia es de mejor esfuerzo y nunca hace fallar el envío. Los borradores no guardan adjuntos.

### Vinculación automática hilo ↔ lead (mejora 6, 20 Nov 2026)

**Migración** `20261120150000_email_thread_lead_link_source.sql` (aplicar a mano en el SQL editor **antes** de desplegar): añade `email_threads.lead_link_source` (`'manual' | 'auto' | NULL`, con CHECK) y marca como `manual` las vinculaciones que ya existían. RLS y grants sin cambios (SELECT/UPDATE de hilos solo Admin, FORCE RLS). Sin variables de entorno nuevas.

**Cuándo se vincula.** Al guardar un correo **entrante** (webhook), al **enviar** un correo nuevo (compose) y al **responder** en un hilo (`autoLinkThread` en `src/lib/email/lead-link.ts`). El reenvío no vincula (el destinatario es un tercero). Si el hilo ya tiene lead, no se hace nada.

**Regla.**

1. Direcciones candidatas = remitente + To + Cc (entrante) o To + Cc (saliente), normalizadas (minúsculas, sin espacios, `Nombre <a@b>` → `a@b`), sin nuestros buzones (`hola@`, `ociel@`) y deduplicadas (`lead-match.ts`).
2. Se buscan leads **no archivados** cuyo `email`, `email_commercial` o `email_manager` coincida exactamente (comparación normalizada en ambos lados; la BD solo preselecciona con `ilike`).
3. **Un único lead** → se vincula con `lead_link_source = 'auto'`. **Varios leads distintos** (p. ej. dos fichas duplicadas con el mismo email, o un correo con dos clientes en Cc) → no se vincula y queda para hacerlo a mano. Un mismo lead con varios emails coincidentes cuenta una vez.
4. **Nunca se sobrescribe una decisión humana.** El UPDATE es condicional (`lead_id IS NULL` y origen nulo o `auto`), así que ni siquiera una carrera con una vinculación manual la pisa. Vincular o **desvincular** desde la UI (`PATCH /api/email/threads/[id]` con `lead_id`) guarda `lead_link_source = 'manual'`: un hilo desvinculado a mano no se vuelve a vincular solo. Las vinculaciones anteriores a la migración cuentan como manuales.
5. Es de mejor esfuerzo: cualquier error se registra (`warn`, sin direcciones) y no tumba el webhook ni el envío.

**Backfill (Admin, idempotente).** `POST /api/email/backfill-lead-links` con `requireAdmin`, límite 3/min y body opcional `{ dryRun?, limit? (1–500, defecto 200), offset? }`. Solo recorre hilos con `lead_id` nulo y `lead_link_source` nulo y aplica la misma regla. Responde `{ ok, dryRun, threadsScanned, linked: [{ threadId, leadId }], ambiguous, noMatch, skipped, nextOffset }`; si `nextOffset` no es `null`, repetir con ese `offset`. Probar primero con `dryRun: true`:

```js
await (await fetch("/api/email/backfill-lead-links", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dryRun: true }),
})).json();
```

**UI.**

- Ficha del lead (`LeadDrawer`): sección **Correos** (`LeadEmailsSection`) con los hilos vinculados (asunto, fragmento, fecha, nº de mensajes, etiqueta «No leído»), cada uno enlazado a `/correo?thread=<id>`, y botón **Desvincular** (`PATCH` con `lead_id: null`). Se monta para Admin y Seller (las APIs del buzón usan `requireCorreoAccess` y RLS). Viewer y la demo de visitante no la ven ni pueden llamar a la API. Excluye la Papelera.
- `/correo?thread=<uuid>` abre ese hilo en su bandeja (Recibidos, Archivados o Papelera); si no existe, avisa.
- Vista del hilo: la etiqueta de lead muestra «Lead vinculado · automático» (con ayuda) o «· manual». El origen viene de `GET /api/email/threads/[id]` (`lead_link_source`). Tras responder, la vista se resincroniza por si la respuesta vinculó el hilo.

**Aceptación.**

- [x] Un entrante o un envío con un único lead coincidente vincula el hilo como `auto`. (tests: `lead-match.test.ts`, `lead-link.test.ts`, `inbound-store.test.ts`, `send-compose.test.ts`, `send-reply.test.ts`)
- [x] Varios candidatos no vinculan; una vinculación manual (o un hilo desvinculado a mano) no se sobrescribe; mayúsculas y espacios no impiden el match. (`lead-link.test.ts`, `lead-match.test.ts`)
- [x] Backfill con `dryRun`, idempotente y solo Admin. (`lead-link-backfill.test.ts`, `backfill-lead-links-route.test.ts`)
- [x] La ficha del lead lista los hilos vinculados y permite desvincular; Seller/Viewer no acceden al correo. (`lead-emails-section.test.tsx`, `thread-state-routes.test.ts`)
- [x] El hilo indica si la vinculación es automática o manual; el diálogo de vinculación manual sigue funcionando. (`thread-view.test.tsx`, `link-lead-dialog.test.tsx`)

## 6. Riesgos

- **Spam y abuso.** El MX va a atraer correo que no es de un cliente. Hay que imponer un tope de tamaño al cuerpo del webhook, limitar la tasa de la ruta y descartar destinatarios fuera de la allowlist (`hola@`, `ociel@`). Sanear el HTML antes de pintarlo. No cargar imágenes remotas por defecto (píxeles de seguimiento y sorpresas de contenido mixto).
- **Adjuntos.** 50 MB por fichero (52 428 800 bytes), igual que la spec del portal de cliente. Rechazar los que pasen de ahí. Las `download_url` de los adjuntos caducan; hay que bajarlas al atender el webhook, o guardar solo metadatos y aceptar que los bytes pueden exigir otra llamada a la API. Cuánto tiempo se conservan los bytes, si se guardan, es una pregunta abierta (sección 7).
- **Ráfaga al webhook.** Rate limit en el `POST` de la ruta de entrada. Una firma fallida no es motivo para parsear ni guardar el cuerpo.
- **DNS.** Un segundo MX, o poner el MX en Proxied (nube naranja), rompe la recepción. Borrar `send`, `rsend`, el DKIM o `_dmarc` rompe el correo que ya se envía.
- **Secretos.** `RESEND_INBOUND_WEBHOOK_SECRET` y cualquier clave de API de Resend viven solo en Vercel. Si una se filtra, se rota en Resend. No se commitea.
- **Rejuego.** La verificación Svix cubre firmas con marca de tiempo. Aun así, se deduplica por `email_id`.

## 7. Preguntas abiertas

1. ¿Qué roles además de Admin pueden ver el buzón? **Respondido: Seller sí, Viewer no.**
2. ¿Cuánto tiempo se conservan los bytes de los adjuntos, si es que se guardan?
3. ¿A quién se avisa cuando llega correo nuevo, y por qué canal?

Hasta que se responda: solo Admin, adjuntos solo con metadatos si no hay bucket, y sin aviso de correo nuevo.

## 8. Futuro: bandejas (parcial)

**Hoy.** Correo es un **timeline por hilo** más **borradores de mensajes nuevos** (`email_drafts`, pill Borradores). Lista densa tipo Gmail (remitente, asunto, fragmento del último mensaje, fecha corta, clip de adjunto, negrita si no leído), filtrable por `mailbox_address`. Vistas **Recibidos / Enviados / Archivados / Papelera** (Enviados: PR #106) con contador de no leídos por vista y en la entrada Correo de la barra lateral, y paginación «Cargar más» (50). Leído/no leído, archivar, papelera y restaurar, uno a uno o en bloque con casillas. Compose/reply vía Resend. No hay Spam. Los borradores de **respuesta** ya existen (`email_drafts.thread_id`, autoguardado por hilo; ver Fase 3). Compose, responder y reenviar admiten Cc/Cco, firma por buzón y adjuntos salientes (ver «Redactar: Cc/Cco, autoguardado, firma y adjuntos»). Desde el punto 7 la carpeta, la cuenta y el hilo abierto viven en la URL (`/correo/<carpeta>[/<id>]?cuenta=`); antes había una sola ruta, `/correo`.

**Bandejas (9 Oct 2026).** Migración `20261009180000_email_thread_inbox_state.sql` (aplicar a mano en el SQL editor **antes** de desplegar):

- `email_threads.archived_at` / `trashed_at` (timestamptz). Recibidos = ambos nulos; Archivados = `archived_at` con fecha; Papelera = `trashed_at` con fecha. Restaurar desde Papelera devuelve el hilo a donde estaba.
- `email_threads.last_snippet` (200 caracteres) y `has_attachments`, mantenidos por triggers sobre `email_messages` y `email_attachments` (con relleno de filas existentes). Un entrante nuevo saca el hilo de Archivados; uno en Papelera se queda allí.
- Leído/no leído sigue en `email_threads.is_read`.
- RLS sin cambios (SELECT/UPDATE de hilos solo Admin, FORCE RLS).
- API: `GET /api/email/threads?view=inbox|archived|trash`, `PATCH /api/email/threads` (en bloque: `{ ids, is_read?, archived?, trashed? }`, máx. 100), `PATCH /api/email/threads/[id]` (acepta también `archived` y `trashed`), `GET /api/email/threads/unread-count`. Todo con `requireAdmin` y zod.
- **Purga de la Papelera (PR #106):** el cron `GET /api/cron/retention` cuenta (y, si `RETENTION_ENABLED=true`, borra) los hilos con `trashed_at` anterior a 30 días. Hace falta haber aplicado a mano la migración `20261118220000_purge_trashed_email_threads.sql`. Sin esa variable el cron sigue en dry-run y solo informa recuentos.

**Búsqueda (10 Oct 2026).** Migración `20261010090000_email_search.sql` (aplicar a mano **antes** de desplegar): columnas generadas `search_tsv` (tsvector) con índice GIN en `email_messages` (asunto + remitente + `body_text`) y `email_threads` (asunto + remitente). Config `spanish` para asunto y cuerpo y `simple` para el remitente; el email se parte en palabras. `GET /api/email/threads?q=…&scope=view|all` (máx. 200 caracteres): la entrada se convierte en `palabra:* & palabra:*` (prefijo, sin operadores del usuario) y va por `textSearch` de PostgREST, parametrizado. La UI tiene caja de búsqueda con debounce de 300 ms, botón de borrar y casilla «Buscar en todas las bandejas». Límites: sin `unaccent` (buscar «informacion» no encuentra «información»), máx. 200 hilos por búsqueda.

**Camino de diseño (cuando se aborde).** Vocabulario propuesto:

| Bandeja | Idea | Notas de diseño |
| --- | --- | --- |
| Entrada | Hilos con al menos un inbound reciente / no archivados | Vista por defecto; no confundir con el filtro por dirección (`hola@` / `ociel@`). |
| Enviados | Mensajes o hilos con outbound | Puede ser filtro/vista sobre `email_messages.direction = outbound`, no necesariamente otra tabla. |
| Spam | Correo no deseado | Requiere fuente: marca manual y/o señal del proveedor. Hoy solo se descarta fuera de allowlist. |
| Borradores | Respuestas o mensajes no enviados | **Hecho (parcial):** mensajes nuevos y borradores de respuesta por hilo en `email_drafts` (sin adjuntos guardados). No mezclar con `/email` (borradores de leads). |
| Archivo (opcional) | Hilos fuera de Entrada sin borrar | Columna o flag en `email_threads`, no carpeta física. |

**Restricciones.**

- Los borradores de respuesta siguen en `email_drafts` con `thread_id`; los de mensaje nuevo de un lead usan `lead_id` y `thread_id IS NULL`.
- El filtro por `mailbox_address` (allowlist) es ortogonal a las bandejas: un hilo de `ociel@` puede estar en Entrada o Enviados.
- Spam sigue abierto (sección 7). La retención de adjuntos está resuelta: el cron de retención borra también los archivos en Storage de los hilos purgados (PR #106).
- Criterio de arranque: solo tras validar dual mailbox V1 en uso real.

## 9. Mejoras de la bandeja (puntos 1–7)

Estas mejoras se acordaron con Ociel después de las Fases 1–3. El orden de trabajo fue 1, 2, 3, 5, 6, 7, 4.

| Punto | Alcance | Estado |
| --- | --- | --- |
| 1 | Paginación / «Cargar más» (páginas de 50) | Hecho (PR #106) |
| 2 | Purga real de la Papelera a los 30 días (cron de retención) | Hecho (PR #106; migración `20261118220000_purge_trashed_email_threads.sql`) |
| 3 | Bandeja Enviados (hilos con al menos un mensaje `outbound` y que no están en Papelera) | Hecho (PR #106) |
| 4 | Persistir adjuntos entrantes en Storage cuando existe `EMAIL_ATTACHMENTS_BUCKET` | Hecho (PR #106). Configurado en producción el 27 nov 2026: bucket privado `email-attachments` y variable `EMAIL_ATTACHMENTS_BUCKET` en Vercel. |
| 5 | Cc/Cco, autoguardado, firma por buzón y adjuntos salientes | Hecho (PR #108; ver «Redactar: Cc/Cco, autoguardado, firma y adjuntos») |
| 6 | Vinculación automática hilo↔lead, origen auto/manual y sección «Correos» en la ficha del lead | Hecho ([PR #109](https://github.com/GallaGit/GallaDev_workspace/pull/109); ampliado en el [PR #115](https://github.com/GallaGit/GallaDev_workspace/pull/115) con borradores desde la ficha y acceso Seller) |
| 7 | Actualizar la lista al llegar correo nuevo; rutas por carpeta; barra lateral dedicada al correo; Cuentas; vista móvil | **Hecho** (rutas por carpeta, barra de correo, Cuentas, refresco cada 60 s y drawer móvil; detalle abajo) |

### Punto 7 — Rutas por carpeta, barra lateral de correo, Cuentas y vista móvil

**Estado:** Hecho.

**Implementación.** Rutas `/correo/recibidos|enviados|archivados|papelera|borradores[/<id-del-hilo>]` con `?cuenta=`; `/correo` redirige (308) a `/correo/recibidos`, y los enlaces antiguos `/correo?thread=<id>` siguen funcionando. El estado vive en la URL y el cambio de carpeta, cuenta o hilo no recarga el servidor (`history.pushState`). `AppShell` sustituye `AppSidebar` por `CorreoSidebar` en `/correo/*` (Admin y Seller). La lista se refresca cada 60 s, al volver a la pestaña y con `correo:unread-changed`, sin perder el scroll ni el hilo abierto. Redactar y responder reutilizan `ComposeDialog` (variante en línea en el área ancha). No hay migraciones de base de datos.

#### Problema

En el móvil el panel izquierdo de `/correo` (ancho fijo de 320 px: carpetas Recibidos, Enviados, Archivados y Papelera, el filtro de buzón, Borradores y la lista de hilos) comparte fila con la vista de lectura y no se oculta. En una pantalla estrecha tapa o deja casi sin espacio el correo abierto. No hay una pantalla de lista a ancho completo ni un botón para volver.

#### Estado previo al PR #114 (histórico)

- La ruta del módulo es **`/correo`**: una sola página (`src/app/correo/page.tsx` → `InboxPage`), sin segmentos de carpeta. El banco `/email` se eliminó; `/email` redirige a `/correo/borradores`.
- Las carpetas no tienen URL. Viven en el estado del cliente: `view` es `inbox` / `sent` / `archived` / `trash` (`THREAD_VIEWS` en `src/lib/email/thread-state.ts`). Borradores es un `listMode` aparte (`drafts`): hoy un botón junto a los chips de buzón, no una entrada de esa lista de vistas.
- Etiquetas en la UI (es): Recibidos, Enviados, Archivados, Papelera, Borradores. No hay carpeta Spam.
- El filtro de cuenta es también estado del cliente (`Todos` / `hola@` / `ociel@`; allowlist `COMPANY_MAILBOXES` en `src/lib/email/mailboxes.ts`). La API ya acepta `GET /api/email/threads?view=&mailbox=`.
- La barra lateral (`src/components/layout/app-sidebar.tsx`) tiene una sola entrada «Correo» que apunta a `/correo`, con la insignia de no leídos de Recibidos. No se despliega. En el móvil el menú de la app es un cajón (breakpoint `md`, 768 px).
- El acceso es Admin y Seller (APIs con `requireCorreoAccess`, RLS). No hay permisos distintos por buzón: ven `hola@` y `ociel@`. Viewer y la demo de visitante no usan el buzón (la entrada se oculta; las APIs responden 403). Ajustes de firma, backfill, purga e importación de borradores antiguos siguen siendo solo Admin.
- Los contadores de no leídos se refrescan cada 60 s, al volver a la pestaña y con el evento `correo:unread-changed`. **La lista de hilos no se recarga sola** cuando llega correo nuevo.

#### Requisitos

**Rutas por carpeta.** Cada carpeta existente tiene su propia dirección, con slugs en español (como el resto de rutas de la app) en todos los idiomas de la UI:

| Carpeta | Vista actual | Ruta |
| --- | --- | --- |
| Recibidos | `view=inbox` | `/correo/recibidos` |
| Enviados | `view=sent` | `/correo/enviados` |
| Archivados | `view=archived` | `/correo/archivados` |
| Papelera | `view=trash` | `/correo/papelera` |
| Borradores | `listMode=drafts` | `/correo/borradores` |

El prefijo es **`/correo`** (singular), confirmado por Ociel. Redirecciones permanentes (308 o la equivalente en Next.js):

- `/correo` → `/correo/recibidos`
- cualquier otra ruta bajo `/correo/…` que no sea una carpeta conocida → la carpeta equivalente, o `/correo/recibidos` si no hay equivalente

No se crea una carpeta Spam. `/email` redirige de forma permanente a `/correo/borradores`. Correo es Admin y Seller; queda oculto al visitante y al Viewer.

La carpeta por defecto es Recibidos. Un hilo abierto es compartible y sobrevive a un recargo: `/correo/{carpeta}/{threadId}` (UUID), conservando la cuenta en la query si aplica. En Borradores no hay esta ruta de hilo; abrir un borrador abre la vista de redacción en el área de contenido.

**Barra lateral de correo (sustitución completa).** Al entrar en `/correo/…`, la barra lateral general de la app se sustituye por completo por una barra dedicada al correo. No es un desplegable de subopciones bajo la entrada «Correo» del menú general. Esa entrada del menú general sigue siendo el modo de entrar al módulo; una vez dentro, la barra general ya no está a la vista.

Arriba de la barra de correo hay un botón **Atrás** que restaura la barra general (vuelve a la página anterior o, si no hay una clara, al dashboard).

La barra de correo contiene todo excepto el cuerpo del mensaje:

- el botón Atrás
- el botón **Nuevo**
- las cinco carpetas (Recibidos, Enviados, Archivados, Papelera, Borradores), con la insignia de no leídos que ya existe en cada una, cuando aplique
- **Cuentas** (Todas, `hola@`, `ociel@`)
- la lista de hilos (o de borradores) de la carpeta y cuenta seleccionadas
- la búsqueda, junto a la lista

El área ancha principal muestra **solo** el contenido del hilo abierto, la vista de redacción o un estado vacío (por ejemplo «Selecciona un correo»). No hay en esa área una segunda columna de lista ni de carpetas.

**Escritorio** (`md` y superior, 768 px): la barra de correo y el área de contenido se ven a la vez. Cambiar de carpeta o de cuenta actualiza la lista en la barra y la URL; el área ancha solo cambia si se abre un hilo, se empieza a redactar o no hay selección.

**Cuentas.** En la barra de correo, **Cuentas** se despliega en:

- Todas
- `hola@` (local-part de `hola@galladev.com`)
- `ociel@` (local-part de `ociel@galladev.com`)

Si en el futuro hay más buzones en la allowlist, salen aquí. La cuenta se combina con la carpeta: filtrar por `hola@` en Recibidos no saca al usuario de Recibidos.

Se usa un **parámetro de query** `cuenta`, no un segmento de ruta. Valores: se omite o `todas` para todos los buzones visibles; `hola` u `ociel` (el local-part) para un buzón. Ejemplo: `/correo/recibidos?cuenta=hola`. Un valor desconocido o no permitido se trata como Todas (o se redirige a la URL sin `cuenta`).

Por qué un query y no `/correo/hola/recibidos`: la carpeta y el buzón ya son ejes ortogonales (sección 8 y el filtro `mailbox` de la API). Así no se multiplica el árbol de rutas, cambiar de cuenta no pierde la carpeta ni el hilo, y «Cuentas» en la barra de correo es un filtro, no una página de destino. El cliente traduce `cuenta` al parámetro `mailbox` que ya entiende `GET /api/email/threads`.

**Permisos.** No se inventa un RBAC nuevo por buzón. Hoy solo Admin entra, y ve las dos cuentas. Cuentas solo lista los buzones que esa sesión puede ver. Una URL con `cuenta` de un buzón no permitido no devuelve esos hilos (403 o redirección a Todas / a un buzón permitido). Si más adelante otros roles pueden abrir Correo o un buzón concreto (pregunta abierta de la sección 7), este filtro lo respeta.

**Móvil** (por debajo de `md`, 768 px, el mismo corte que el cajón del menú general): la división es la misma que en escritorio (barra de correo / contenido), pero no se ven a la vez.

- **Decisión de implementación (requisito de Ociel, prevalece sobre el borrador a pantalla completa):** en el móvil la barra de correo es un **cajón (drawer) plegable**, nunca una columna permanente que tape el contenido. Un botón de menú en la cabecera lo abre; se cierra al tocar un hilo, el fondo oscuro (overlay), la X o Escape. Con el cajón cerrado, el área ancha muestra el hilo, la redacción o el estado vacío (con un botón «Abrir bandeja»).
- El cajón contiene Atrás, Nuevo, búsqueda, carpetas, Cuentas y la lista (con su propio scroll vertical). Elegir carpeta o cuenta mantiene el cajón abierto; abrir un hilo lo cierra.
- El **Atrás** de la parte superior de la barra de correo restaura el menú general de la app (página anterior o dashboard).
- **Nuevo** abre la vista de redacción en el área de contenido y cierra el cajón.
- **Sin scroll horizontal.** El cuerpo HTML del correo va en un iframe aislado con CSS de ajuste (`max-width:100%`, imágenes y tablas adaptables, `overflow-wrap:anywhere`, `pre`/`code` con salto de línea); solo una tabla ancha puede desplazarse dentro de su propia caja. La cabecera, los adjuntos y la lista usan `min-w-0` y `overflow-x-hidden`.

**Actualizar la lista al llegar correo nuevo** (el alcance original del punto 7; se mantiene). Si llega un mensaje nuevo que pertenece a la carpeta y cuenta que se están viendo, la lista se actualiza sin recargar la página a mano ni perder la selección, el scroll o un hilo abierto. Las insignias de no leídos de la barra de correo se actualizan también, incluso si el mensaje cae en otra carpeta. El intervalo es **cada 60 s**, el mismo que los contadores, y también al volver a la pestaña y con el evento `correo:unread-changed`. Esta entrega no exige WebSocket. No sustituye un aviso push fuera de la app (eso sigue siendo la pregunta 3 de la sección 7).

#### Criterios de aceptación

- [ ] Un Admin abre `/correo/recibidos`, `/correo/enviados`, `/correo/archivados`, `/correo/papelera` y `/correo/borradores`, y ve la carpeta que indica la URL. Recargar o compartir la URL conserva la carpeta.
- [ ] `/correo` redirige a `/correo/recibidos`. `/email` redirige a `/correo/borradores`.
- [ ] Al entrar en Correo, la barra lateral general se sustituye por la barra de correo (Atrás, Nuevo, las cinco carpetas, Cuentas y la lista). El área ancha solo muestra el hilo abierto, la vista de redacción o un estado vacío.
- [ ] El Atrás de la parte superior de la barra de correo restaura la barra general de la app (página anterior o dashboard).
- [ ] Elegir una carpeta navega a su ruta. Elegir Todas / hola@ / ociel@ aplica el filtro y se queda en la carpeta actual, con `?cuenta=` en la URL (Todas puede omitir el parámetro).
- [ ] `?cuenta=hola` en Recibidos solo lista hilos de `hola@galladev.com`. El filtro se puede combinar con la búsqueda que ya existe.
- [ ] Seller, Viewer y la demo de visitante no ven las nuevas rutas ni sus APIs (el mismo criterio que `/correo`). Un visitante no ve «Correo» en el menú general.
- [ ] En escritorio (`md` y superior) se ven a la vez la barra de correo y el área de contenido; la lista no está en el área ancha.
- [ ] En un ancho menor de 768 px, la barra de correo es un cajón plegable (botón de menú; se cierra al tocar un hilo, el overlay o la X) y nunca tapa el contenido de forma permanente. El hilo no produce scroll horizontal. El Atrás de la barra vuelve al menú general de la app.
- [ ] Con la bandeja abierta, un correo nuevo que encaja en la vista aparece en la lista en no más de 60 s (el mismo ritmo que los contadores; también al volver a la pestaña), y las insignias se actualizan, sin recargar a mano.
- [ ] No se añade Spam. Correo queda disponible para Admin y Seller. `/email` redirige a `/correo/borradores`.

#### Fuera de alcance

- Carpeta Spam, avisos fuera de la app cuando llega correo, y qué otros roles además de Admin ven el buzón (siguen en la sección 7).
- Una ruta propia para «Nuevo mensaje» (la redacción se abre en el área de contenido, sin URL dedicada).
- Cambiar la API (`view`, `mailbox`) más de lo necesario para las URLs nuevas.
- El trabajo del punto 6 (PR #109) y cualquier otra mejora de redacción o vinculación.
