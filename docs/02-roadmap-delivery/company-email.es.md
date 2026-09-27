# Email De Empresa (galladev.com) — Prioridad Urgente

> **Estado:** documentado, no configurado · **Prioridad urgente — lunes 28 sep 2026**
> **Actualizado:** 2026-09-27 · EN: [`company-email.md`](./company-email.md)
> **Recomendación, pendiente de decisión de Ociel:** opción A ahora (coste 0). Opción B cuando haya clientes o equipo.

Este documento es operativo. No cambia código. La gestión de emails dentro de GDW sigue en el backlog, sin spec.

## 1. Problema y objetivo

Hoy GallaDev **envía** correo transaccional desde `hola@galladev.com` y **no puede recibirlo**. No hay buzón de empresa. Nadie lee el correo que llega a `hola@galladev.com`, y nadie responde desde esa dirección como persona. Las respuestas al acuse del formulario se pierden.

Objetivo del lunes 28 sep 2026: **recibir y responder** como `@galladev.com` (`hola@`, y `ociel@` si Ociel lo quiere), con el envío de Resend igual que ahora.

- El dominio sigue en Cloudflare. El apex y `www` siguen en proxy naranja.
- Resend sigue verificado y sigue mandando el acuse al visitante y el aviso interno.
- El portal de cliente (informe semanal en PDF por Resend) sigue siendo spec, no producto. Ver [`client-portal.es.md`](./client-portal.es.md).
- Un buzón real de equipo (Google Workspace) queda para cuando haya clientes o más personas.

## 2. Estado actual

Hechos al 27 sep 2026. Sin valores de secretos.

### DNS en Cloudflare (dominio `galladev.com`)

Resend verificó el dominio el 18 sep 2026. El return-path de Resend usa el subdominio `send`, así que el **apex aún no tiene MX**.

| Registro | Nombre | Destino / contenido | Proxy | Función |
| --- | --- | --- | --- | --- |
| Web (apex) | `galladev.com` | sitio web | Proxied (naranja) | Web |
| Web | `www` | sitio web | Proxied (naranja) | Web |
| TXT | `resend._domainkey` | DKIM de Resend (el valor vive en Cloudflare) | DNS only | Firma DKIM de Resend |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | DNS only | Resend |
| CNAME | `send` | `send.forge.rmta.net` | DNS only | Return-path de Resend |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DNS only | DMARC en `p=none` |

El SPF de Resend está en `send`, no en el apex. El lunes el apex debe quedar con **un solo** TXT SPF (sección 4).

### Envío que ya funciona

La landing hace `POST /api/ingest/lead` en `workspace.galladev.com` (Vercel). Resend manda el acuse al visitante y el aviso interno desde `hola@galladev.com` a `ociel.galla@gmail.com`. Ese recorrido pasó de punta a punta el 18 sep 2026.

| Variable en Vercel | Papel |
| --- | --- |
| `EMAIL_FROM_CLIENTS` | Remitente hacia clientes (`hola@galladev.com`) |
| `EMAIL_NOTIFY_TO` | Aviso interno (hoy `ociel.galla@gmail.com`) |
| `RESEND_API_KEY` | Clave solo de envío, la de la app. No se reutiliza en Gmail |

Los valores están en Vercel. No se copian a git ni a este documento.

### Hueco

No existe un buzón que reciba en `hola@galladev.com`. Contestar ese acuse, a mano y como la empresa, todavía no tiene camino.

## 3. Opciones comparadas

| | A. Cloudflare Email Routing + Gmail | B. Google Workspace | C. Zoho Mail |
| --- | --- | --- | --- |
| Coste | 0 € en Cloudflare. El envío «como `hola@`» gasta cuota de Resend (abajo). | De pago por usuario/mes. Business Starter, ficha oficial consultada el 27 sep 2026 ([Business editions](https://knowledge.workspace.google.com/admin/getting-started/editions/business-editions), actualizada el 2026-09-24 UTC): Flexible **8,40 USD** / usuario / mes; Annual/Fixed-Term **7 USD** / usuario / mes. Google añade «o el equivalente en moneda local». El importe en EUR: ver precio vigente en esa ficha. | Plan Free, ayuda oficial actualizada el 2 sep 2026 ([Subscription](https://www.zoho.com/mail/help/adminconsole/subscription.html)): hasta 5 usuarios, un dominio, 5 GB/usuario, solo web, y solo en centros de datos seleccionados. Mail Lite (5 o 10 GB, con IMAP/POP) y Mail Premium (50 GB + 50 GB de archivo) son de pago. El importe no sale en el HTML de [la página de precios](https://www.zoho.com/mail/zohomail-pricing.html): **ver precio vigente**. |
| Esfuerzo | Bajo. Panel de Cloudflare y «Enviar como» en Gmail. | Medio. Alta, verificación del dominio y MX de Google en el apex. | Medio. Alta, MX de Zoho en el apex, y comprobar si el Free existe en el centro de datos. |
| Pros | Encaja con esta etapa. El correo llega al Gmail que ya se usa. Resend sigue mandando lo transaccional. | Buzón propio, calendario y consola cuando haya clientes o equipo. | Buzón en el dominio. El Free puede bastar para probar, si la región lo ofrece. |
| Contras | No es un buzón alojado: es reenvío. Enviar como `hola@` depende del SMTP de Resend y de su cuota. | Coste mensual por usuario. Hay que convivir con los registros de Resend. | El Free no incluye IMAP/POP ni reenvío (eso va en planes de pago, misma ayuda). Puede no ofrecerse en la UE. Otro panel. |
| Riesgo DNS | Bajo si el SPF del apex queda en un solo registro. Routing añade MX `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net` y un TXT SPF en el apex (`include:_spf.mx.cloudflare.net`). El SPF de Resend sigue en `send`. DKIM `resend._domainkey` y `_dmarc` no se tocan. Los registros web naranjas tampoco. | Medio. El apex pasaría a los MX de Google. Un solo conjunto de MX: Routing de Cloudflare y Google a la vez no conviven. DKIM de Resend y los CNAME `send` / `rsend` se quedan. | Medio. MX de Zoho en el apex, incompatibles con los de Cloudflare Email Routing. Mismo cuidado: un solo SPF, y Resend intacto en `send`. |

### Cuota de Resend (opción A, al enviar desde Gmail)

Consultado el 27 sep 2026 en [resend.com/pricing](https://resend.com/pricing):

- Free: 0 USD, 3.000 correos/mes y tope de 100/día.
- Pro: desde 20 USD/mes por 50.000 correos/mes (hay tramos superiores en la misma página).

Cada mensaje salido por el SMTP de Resend cuenta en esa cuota, junto con el acuse de la landing y, el día que exista, el PDF semanal del portal.

### Recomendación, pendiente de decisión de Ociel

**A para el lunes** (coste 0, etapa actual). **B cuando haya clientes o equipo.** C queda como alternativa de buzón barato si A no convence; el precio de pago se confirma en la web de Zoho antes de contratar.

## 4. Plan paso a paso para el lunes (opción A)

Los pasos de panel (Cloudflare y Resend) se hacen en el **PC de Ociel en la UE**.

### 4.1 Activar Email Routing y revisar el SPF

- **Quién:** Ociel.
- **Qué:** Cloudflare → Email → Email Routing → activar. El asistente añade en el apex los MX `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net` y `route3.mx.cloudflare.net`, y un TXT SPF.
- **SPF:** el apex termina con **un solo** registro SPF, y ese registro incluye `include:_spf.mx.cloudflare.net`. Si ya hubiera otro `v=spf1`, se funden en uno. Dos TXT SPF rompen la comprobación.
- **Intactos:** `resend._domainkey`, CNAME `send` y `rsend`, TXT `_dmarc` (`p=none`), y el proxy naranja del apex y de `www`.
- **Comprobación:** en la lista DNS hay tres MX de Cloudflare, un solo SPF en el apex, y los registros de la tabla de la sección 2 siguen igual. El agente puede leer un `dig` público que pegue Ociel (sin secretos).

### 4.2 Destino y reglas

- **Quién:** Ociel.
- **Qué:** verificar el destino `ociel.galla@gmail.com`. Regla `hola@galladev.com` → ese Gmail. `ociel@` solo si la respuesta de la sección 7 es sí. El catch-all espera esa misma decisión; hasta entonces no se enciende.
- **Comprobación:** Cloudflare marca el destino como verificado y la regla de `hola@` activa.

### 4.3 Gmail «Enviar correo como» `hola@galladev.com`

- **Quién:** Ociel. El agente no ve la clave.
- **Qué:** en Resend, una **clave nueva, solo de envío**, distinta de la `RESEND_API_KEY` de Vercel. Ociel la pega solo en Gmail.
- **SMTP:** host `smtp.resend.com`, puerto **465** o **587**, usuario `resend`, contraseña = esa clave nueva.
- **Comprobación:** Gmail da por confirmada la dirección. El correo de confirmación entra por el reenvío de `hola@`.

### 4.4 Reply-To en los correos transaccionales

- **Quién:** agente, en un PR de código posterior. **Fuera de este PR.**
- **Qué:** que el acuse lleve Reply-To `hola@galladev.com`, para que la respuesta del visitante entre por Email Routing. El README ya nombra la variable opcional `EMAIL_REPLY_TO`; el valor no va en git.
- **Comprobación:** cuando exista ese cambio, un acuse de prueba muestra ese Reply-To y la respuesta llega a Gmail.

### 4.5 Pruebas del lunes

- **Quién:** Ociel envía y mira Gmail. El agente ayuda a leer cabeceras si Ociel pega «Mostrar original» (sin secretos ni claves).
- **Recibir:** un correo desde una cuenta externa a `hola@galladev.com` aparece en `ociel.galla@gmail.com`.
- **Enviar:** responder desde Gmail como `hola@galladev.com`. En mail-tester o en «Mostrar original», SPF, DKIM y DMARC en pass.
- **Resend sigue:** el formulario de la landing sigue entregando acuse y aviso interno.

### 4.6 DMARC más adelante

- **Quién:** Ociel, pasadas 2–4 semanas de informes limpios. No bloquea el lunes.
- **Qué:** pasar `_dmarc` de `p=none` a `p=quarantine`. Un `rua` de informes es opcional.
- **Comprobación:** los mensajes de la sección 4.5 siguen en pass después del cambio.

## 5. Riesgos y rollback

| Riesgo | Qué hacer |
| --- | --- |
| Dos TXT SPF en el apex | Dejar uno solo, con `include:_spf.mx.cloudflare.net`. |
| Pisar DKIM, `send`, `rsend` o `_dmarc` | Esos registros se quedan como en la sección 2. |
| Tocar el proxy del apex o de `www` | Esos registros web se quedan naranjas. |
| MX de Routing y MX de Google o Zoho a la vez | Un solo conjunto de MX en el apex. |
| Reutilizar la clave de Vercel en Gmail | Clave nueva, solo de envío, solo en Gmail. Si esa clave se filtra, se revoca esa clave. |
| Catch-all abierto | El spam del dominio acaba en Gmail. Decisión explícita en la sección 7. |
| Cuota Free de Resend (100/día, 3.000/mes) | El envío desde Gmail comparte cupo con la landing. |

**Rollback:** desactivar Email Routing. Cloudflare retira los MX que añadió. Comprobar que el apex vuelve al estado previo (sin MX de Routing) y que el SPF del apex no queda a medias. Los registros web y los de Resend no se editan en el rollback.

## 6. Criterios de aceptación

- [ ] Email Routing activo en `galladev.com`.
- [ ] El apex tiene los MX `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net` y `route3.mx.cloudflare.net`.
- [ ] Un solo TXT SPF en el apex, con `include:_spf.mx.cloudflare.net`.
- [ ] `resend._domainkey`, CNAME `send` → `send.forge.rmta.net`, CNAME `rsend` → `rsend-euw1.forge.rmta.net` y `_dmarc` `v=DMARC1; p=none;` siguen igual.
- [ ] Apex y `www` siguen Proxied.
- [ ] `ociel.galla@gmail.com` está verificado como destino.
- [ ] La regla `hola@` entrega en ese Gmail.
- [ ] Catch-all y direcciones extra quedan decididos y aplicados (sección 7).
- [ ] Gmail envía como `hola@galladev.com` por SMTP de Resend con una clave nueva, solo de envío, distinta de la de Vercel.
- [ ] Un correo externo a `hola@` llega a Gmail.
- [ ] Una respuesta desde Gmail como `hola@` pasa SPF, DKIM y DMARC.
- [ ] El acuse y el aviso interno de la landing siguen saliendo por Resend.
- [ ] Reply-To queda como tarea de código, fuera de este cambio.

## 7. Preguntas abiertas para Ociel

1. ¿Qué direcciones el lunes? `hola@` está en el plan. ¿También `ociel@`, `contacto@`, `facturas@`?
2. ¿Catch-all sí o no?
3. ¿Opción A (este plan) u opción B (Google Workspace)? La recomendación escrita arriba es A ahora y B con clientes o equipo, y sigue pendiente de tu decisión.
