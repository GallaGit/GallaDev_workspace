# Email De Empresa (galladev.com) — Módulo Correo en GDW

> **Estado:** especificado, no implementado · **Decisión:** Ociel, 29 Sep 2026.
> Sustituye la recomendación del 27 Sep 2026 (Cloudflare Email Routing más «Enviar como» en Gmail, y las alternativas Google Workspace / Zoho). Ese camino no es el plan. Sin Gmail. Sin Google Workspace.
> No presentar como comportamiento actual. Hoy no hay buzón que reciba en `@galladev.com`. El envío desde `hola@galladev.com` por Resend ya funciona. EN: [`company-email.md`](./company-email.md).

Va por delante de la sección «¿Qué es?» del login y de los pendientes de M2 (CodeQL, E2E de Viewer 403, rate limit distribuido, historial de auditoría y la limpieza de mocks de Notion en `tests/mocks/handlers.ts`).

## 1. Decisión

Solo `hola@galladev.com` recibe correo. No hay catch-all. Ningún otro local-part (`ociel@`, `contacto@`, `facturas@`) es un buzón.

La entrada y la salida pasan por Resend. La salida ya sale de `hola@galladev.com`. La entrada es [Resend Inbound](https://resend.com/docs/dashboard/receiving/introduction) (receiving): un registro MX en `galladev.com` que apunta a Resend, puesto en el DNS de Cloudflare por Ociel desde su PC en la UE, y Resend manda un webhook por cada correo recibido.

El buzón es un módulo nuevo, **Correo**, dentro de GDW. Reutiliza la auth, el RBAC y Supabase de GDW. No es una app aparte. La página es `/correo`. Esa ruta no es el banco de trabajo `/email` (borradores de leads). `/email` se queda como está.

Comprobado contra la documentación de Resend el 29 Sep 2026. La recepción inbound está disponible, así que Cloudflare Email Workers no es el plan alternativo.

| Tema | Decisión |
| --- | --- |
| Dirección | Solo `hola@galladev.com`. |
| Catch-all | No. |
| Proveedores descartados | Gmail, Google Workspace, Cloudflare Email Routing, Zoho. |
| Transporte | Resend para entrada y salida. |
| Producto | Módulo Correo en GDW (`/correo`). |

El MX de recepción de Resend acepta cualquier local-part del dominio al que se engancha ([dominios propios](https://resend.com/docs/dashboard/receiving/custom-domains)). La regla de producto sigue siendo una sola dirección. El webhook guarda un mensaje solo cuando `to`, `cc` o `bcc` incluye `hola@galladev.com`. Cualquier otro destinatario no se guarda y no abre un hilo. El manejador igual responde éxito tras una firma válida, para que Resend no reintente un mensaje que GDW decidió no conservar.

## 2. Estado actual

Hechos al 27 Sep 2026, vigentes el 29 Sep 2026. Sin valores de secretos.

| Pieza | Hecho |
| --- | --- |
| Dominio | `galladev.com`. DNS en Cloudflare. |
| Web | Apex y `www` en Proxied (nube naranja). No tocarlos. |
| Resend | Dominio `galladev.com` **Verified** el 18 Sep 2026. El envío funciona. La recepción no está activada. |
| Envío | Landing → `POST /api/ingest/lead` en `workspace.galladev.com` (Vercel) → Resend. Acuse al visitante y aviso interno. Remitente `hola@galladev.com`. Aviso a `ociel.galla@gmail.com`. E2E de ese envío pasado el 18 Sep. |
| Vercel | Están `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO` y `RESEND_API_KEY` (clave solo de envío). |
| Código | `EMAIL_REPLY_TO`, si está definida, sale como Reply-To (`src/lib/email/resend-client.ts`, `send-ingest-emails.ts`). No consta entre las variables de Vercel de arriba. |
| Hueco | No hay buzón de empresa. Quien contesta el acuse del formulario escribe a `hola@galladev.com` y ese mensaje no llega a nadie. |
| Apex MX | No hay MX en el apex. Resend usa el subdominio `send` como return-path. |
| Storage | El repo no usa Supabase Storage. No hay buckets. La spec del portal de cliente propone un bucket privado `project-files`; no está creado. |
| `/email` | Banco de borradores de leads. No es un buzón. |

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
| `RESEND_API_KEY` | Ya está definida. Se reutiliza para las respuestas salientes y para la Receiving API (leer el mensaje, listar adjuntos) cuando esa clave pueda llamarlas. Se puede usar una clave dedicada de Resend en lugar de reutilizar esta. La clave dedicada también es solo un secreto de Vercel; esta spec no exige un segundo nombre, y no se commitea. |

`EMAIL_FROM_CLIENTS` y `EMAIL_NOTIFY_TO` se quedan como están. Son el envío transaccional que ya existe, no el buzón.

## 5. Fases

Cada fase está especificada, no implementada. Las fases siguientes no empiezan cambiando el DNS de producción antes de que el webhook de la fase 1 pueda verificar y guardar.

### Fase 1 — Recibir

**Alcance.** Activar Resend inbound para `hola@galladev.com`. Ociel publica el MX en Cloudflare. Una ruta de Next.js verifica el webhook y guarda el mensaje.

Ruta: `src/app/api/email/inbound/route.ts` (el App Router vive bajo `src/app`; la forma es `app/api/email/inbound/route.ts`).

- Rechazar lo que no sea un evento `email.received` verificado.
- Conservar solo el correo para `hola@galladev.com`. Ninguna fila de catch-all.
- Idempotente por `data.email_id`. Una entrega repetida no cambia nada y responde éxito.
- Persistir hilos y mensajes en Supabase, por ejemplo las tablas `email_threads` y `email_messages`.
- Adjuntos: metadatos siempre. Los bytes van a un bucket privado de Storage cuando exista uno. En el repo hoy no hay ninguno (el `project-files` de la spec del portal de cliente no está creado). Hasta que haya bucket, solo metadatos. No inventar un bucket público. Tope de 50 MB por fichero (52 428 800 bytes), el mismo tope que la spec del portal de cliente.
- El webhook no tiene sesión de usuario. La ruta escribe con la credencial de servidor después de comprobar la firma. Las lecturas pasan por el usuario con sesión y por RLS. Solo los roles permitidos leen. Admin es el rol permitido hasta que se responda la pregunta abierta de la sección 7.
- Rate limit en la ruta. El limitador de la app hoy es en memoria y por instancia; esta ruta igual necesita un tope para que una ráfaga no llene la tabla.

**Aceptación.**

- [ ] Receiving de Resend activo en `galladev.com`, y el MX del apex es el único registro que mostró Resend, DNS-only.
- [ ] Apex y `www` siguen Proxied. `send`, `rsend`, DKIM y `_dmarc` iguales. El acuse del formulario sigue saliendo.
- [ ] Un `POST` a la ruta de entrada con firma Svix mala o ausente no escribe ninguna fila.
- [ ] Un mensaje real a `hola@galladev.com` se guarda una vez. Una segunda entrega del mismo `email_id` no inserta otro mensaje.
- [ ] Un mensaje a cualquier otra dirección `@galladev.com` no se guarda.
- [ ] RLS: una sesión Admin puede leer la fila; un rol no permitido, no. Ningún secreto en git.

### Fase 2 — UI del buzón

**Alcance.** `/correo` dentro de GDW: lista de hilos, vista del hilo, leído y no leído, y un modo de enlazar un hilo con un lead. Usa la sesión y el RBAC que ya existen. El acceso es Admin por defecto. Qué otros roles pueden abrirlo es una pregunta abierta (sección 7); hasta que se responda, Seller, Viewer y la demo de visitante no ven el buzón (la misma idea que otras zonas solo Admin: la demo ya redirige `/email`).

**Aceptación.**

- [ ] Un Admin abre `/correo`, ve los hilos de `hola@`, abre uno, y el marcador de no leído se quita al leer el hilo.
- [ ] El Admin puede enganchar un hilo a un lead existente, y el enlace sigue ahí al recargar.
- [ ] Un usuario sin sesión, una sesión de demo de visitante y un rol no permitido no obtienen la lista de hilos ni los cuerpos.
- [ ] El HTML del mensaje se sanea antes de mostrarlo. Las imágenes remotas no se cargan por defecto.

### Fase 3 — Responder

**Alcance.** Desde el hilo abierto, un usuario permitido responde por Resend como `hola@galladev.com`. El hilo sigue la guía de respuesta de Resend: `In-Reply-To` es el `message_id` al que se contesta, y `References` son los `message_id` anteriores del hilo más ese, separados por espacios. El asunto mantiene el hilo (`Re:` más el asunto). El mensaje saliente se guarda en la misma fila de `email_threads`, con su id de Resend, para que una respuesta entrante posterior se una al mismo hilo.

**Aceptación.**

- [ ] La respuesta sale como `hola@galladev.com` por Resend, y SPF, DKIM y DMARC siguen pasando en el envío que ya existe.
- [ ] El payload enviado incluye `In-Reply-To` y `References` construidos con los `message_id` guardados del hilo.
- [ ] La respuesta se ve en ese hilo en `/correo` después de enviarla, y un envío fallido queda marcado como fallido en vez de desaparecer.
- [ ] Un seguimiento desde fuera hacia ese hilo se guarda en el mismo hilo, no como uno nuevo, cuando el `message_id` / `References` entrante coincide.

## 6. Riesgos

- **Spam y abuso.** El MX va a atraer correo que no es de un cliente. Hay que imponer un tope de tamaño al cuerpo del webhook, limitar la tasa de la ruta y descartar destinatarios distintos de `hola@`. Sanear el HTML antes de pintarlo. No cargar imágenes remotas por defecto (píxeles de seguimiento y sorpresas de contenido mixto).
- **Adjuntos.** 50 MB por fichero (52 428 800 bytes), igual que la spec del portal de cliente. Rechazar los que pasen de ahí. Las `download_url` de los adjuntos caducan; hay que bajarlas al atender el webhook, o guardar solo metadatos y aceptar que los bytes pueden exigir otra llamada a la API. Cuánto tiempo se conservan los bytes, si se guardan, es una pregunta abierta (sección 7).
- **Ráfaga al webhook.** Rate limit en el `POST` de la ruta de entrada. Una firma fallida no es motivo para parsear ni guardar el cuerpo.
- **DNS.** Un segundo MX, o poner el MX en Proxied (nube naranja), rompe la recepción. Borrar `send`, `rsend`, el DKIM o `_dmarc` rompe el correo que ya se envía.
- **Secretos.** `RESEND_INBOUND_WEBHOOK_SECRET` y cualquier clave de API de Resend viven solo en Vercel. Si una se filtra, se rota en Resend. No se commitea.
- **Rejuego.** La verificación Svix cubre firmas con marca de tiempo. Aun así, se deduplica por `email_id`.

## 7. Preguntas abiertas

1. ¿Qué roles además de Admin pueden ver el buzón? (Seller, Viewer, ninguno.)
2. ¿Cuánto tiempo se conservan los bytes de los adjuntos, si es que se guardan?
3. ¿A quién se avisa cuando llega correo nuevo, y por qué canal?

Hasta que se responda: solo Admin, adjuntos solo con metadatos si no hay bucket, y sin aviso de correo nuevo.
