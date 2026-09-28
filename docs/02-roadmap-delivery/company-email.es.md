# Email De Empresa (galladev.com) — Prioridad Urgente

> **Estado:** especificado, no implementado · Ociel lo marca como siguiente paso urgente el 27 Sep 2026 · **Para:** lunes 28 Sep 2026
> **Recomendación, pendiente de decisión de Ociel:** opción A (Cloudflare Email Routing).
> No presentar como comportamiento actual. Hoy no hay buzón que reciba en `@galladev.com`. EN: [`company-email.md`](./company-email.md).

Va por delante de la sección «¿Qué es?» del login y de los pendientes de M2 (CodeQL, E2E de Viewer 403, rate limit distribuido, historial de auditoría y la limpieza de mocks de Notion en `tests/mocks/handlers.ts`).

## 1. Problema y objetivo

Hay que poder **recibir y responder** correo como `@galladev.com` (`hola@`, y `ociel@` si Ociel lo quiere), sin romper el envío que ya hace Resend.

El dominio envía. No recibe. Quien contesta el acuse del formulario escribe a `hola@galladev.com` y ese mensaje no llega a nadie.

Fuera de este paso: el informe semanal en PDF del portal de cliente (sigue en [`client-portal.es.md`](./client-portal.es.md), no implementado) y la gestión de emails dentro de GDW (placeholder del roadmap, sin spec).

## 2. Estado actual

Hechos al 27 Sep 2026. Sin valores de secretos.

| Pieza | Hecho |
| --- | --- |
| Dominio | `galladev.com`. DNS en Cloudflare. |
| Web | Apex y `www` en Proxied (nube naranja). No tocarlos. |
| Resend | Dominio `galladev.com` **Verified** el 18 Sep 2026. |
| Envío | Landing → `POST /api/ingest/lead` en `workspace.galladev.com` (Vercel) → Resend. Acuse al visitante y aviso interno. Remitente `hola@galladev.com`. Aviso a `ociel.galla@gmail.com`. E2E de ese envío pasado el 18 Sep. |
| Vercel | Están `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO` y `RESEND_API_KEY` (clave solo de envío). |
| Código | `EMAIL_REPLY_TO`, si está definida, sale como Reply-To (`src/lib/email/resend-client.ts`, `send-ingest-emails.ts`). No consta entre las variables de Vercel de arriba. |
| Hueco | No hay buzón real. Nadie recibe en `hola@galladev.com` ni responde desde esa dirección como persona. |
| Apex MX | No hay MX en el apex. Resend usa el subdominio `send` como return-path. |

Registros DNS de correo que hay que dejar quietos (DNS-only, no Proxied):

| Tipo | Nombre | Destino o valor | Papel |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | (DKIM de Resend; no se copia el valor aquí) | DKIM de Resend |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | Resend |
| CNAME | `send` | `send.forge.rmta.net` | Return-path de Resend |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC, política `none` |

El SPF de Resend vive en `send`, no en el apex.

## 3. Opciones comparadas

| | A. Cloudflare Email Routing | B. Google Workspace | C. Zoho Mail |
| --- | --- | --- | --- |
| Coste | 0 | De pago, por usuario y mes. Business Starter, tabla de Google consultada el 27 Sep 2026: flexible 8,40 USD / 8,10 EUR; anual 7 USD / 6,80 EUR. [Comparación de planes](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans). Impuestos y país pueden cambiar la cifra. | Plan gratis en centros de datos seleccionados: hasta 5 usuarios, un dominio, 5 GB por usuario, acceso web (sin IMAP/POP/ActiveSync). [Suscripción](https://www.zoho.com/mail/help/adminconsole/subscription.html), [precios](https://www.zoho.com/mail/zohomail-pricing.html) (27 Sep 2026). Mail Lite (5 GB / 10 GB) es de pago: **ver precio vigente** en esa página; depende de región y ciclo. |
| Esfuerzo | Bajo. Reenvío al Gmail que ya existe y «Enviar como» en Gmail. | Medio. Alta de usuario, MX del apex, consola de admin. | Medio. Igual que B, más la duda de si el plan gratis existe en el centro de datos de la cuenta. |
| Pros | Coste 0. Encaja con esta etapa. El correo llega a `ociel.galla@gmail.com`. Se responde como `hola@` por SMTP de Resend. No mueve la web ni el DKIM de Resend. | Buzón propio, calendario y varios usuarios cuando haya clientes o equipo. | Buzón propio más barato que Workspace si el precio vigente se mantiene bajo. El plan gratis evita cuota al empezar. |
| Contras | No es un buzón con almacenamiento propio: es reenvío. «Enviar como» depende de Resend y de Gmail. Aplican los límites de envío del plan de Resend (gratis o de pago); no se copian cifras aquí. | Cuota mensual desde el día uno. Hay que cambiar el MX del apex. | El gratis no trae IMAP/POP y no está en todas las regiones. El de pago añade otro proveedor. También pide MX en el apex. |
| Riesgo DNS | Bajo si el apex queda con **un solo** SPF (`include:_spf.mx.cloudflare.net`) y no se tocan DKIM, `_dmarc`, `send`, `rsend` ni la web Proxied. | MX nuevo en el apex. No combinarlo con el MX de Email Routing. No tocar la web Proxied ni los registros de Resend. | Igual que B. |

**Recomendación, pendiente de decisión de Ociel:** A ahora (coste 0, encaja con la etapa). B cuando haya clientes o equipo.

## 4. Plan para el lunes 28 Sep 2026 (opción A)

Los pasos de panel de Cloudflare y de Resend se hacen en el PC de Ociel en la UE.

1. **Activar Email Routing.** Dueño: Ociel. Cloudflare → Email → Email Routing. Al activarlo, Cloudflare añade MX `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net` y `route3.mx.cloudflare.net`, y un TXT SPF en el apex. Comprobación: el apex termina con **un** registro SPF, con `include:_spf.mx.cloudflare.net`. El SPF de Resend sigue en `send`. DKIM (`resend._domainkey`) y `_dmarc` no se modifican. La web Proxied no se toca.
2. **Destino y reglas.** Dueño: Ociel. Verificar el destino `ociel.galla@gmail.com`. Regla `hola@galladev.com` → ese Gmail. `ociel@` y un catch-all quedan en las preguntas abiertas; no crearlos hasta que Ociel lo diga. Comprobación: la regla aparece activa y el destino figura como verificado.
3. **Enviar como `hola@` desde Gmail.** Dueño: Ociel. Gmail → «Enviar correo como» → `hola@galladev.com` por SMTP de Resend: host `smtp.resend.com`, puerto 465 o 587, usuario `resend`, contraseña = una clave **nueva** de Resend, solo de envío. No reutilizar la clave de Vercel. Ociel la pega solo en Gmail; no entra en el repo ni en el chat. Aplican los límites de envío del plan de Resend. Comprobación: Gmail muestra la dirección como añadida, sin pegar la clave en ningún documento.
4. **Reply-To de los transaccionales.** Dueño: agente, en un cambio de código posterior. No entra en esta PR. Hoy el código solo manda Reply-To si existe `EMAIL_REPLY_TO`. Cuando `hola@` ya reciba, las respuestas al remitente `hola@galladev.com` pueden llegar solas. Queda pendiente decidir si hace falta fijar Reply-To en Vercel o en código.
5. **Pruebas.** Dueño: Ociel (envía). El agente puede leer el resultado si Ociel pega las cabeceras, sin secretos. Desde un buzón externo, escribir a `hola@galladev.com` y verlo en Gmail. Responder desde Gmail como `hola@` y comprobar SPF, DKIM y DMARC en «Mostrar original» o en [mail-tester](https://www.mail-tester.com/).
6. **DMARC más adelante.** Dueño: Ociel. Tras 2–4 semanas de informes limpios, pasar `p=none` a `quarantine`. Un `rua` de informes es opcional. No es el trabajo del lunes.

## 5. Riesgos y rollback

- Desactivar Email Routing quita los MX que Cloudflare añadió. El reenvío deja de funcionar. Los registros de la web (apex y `www` Proxied) se quedan.
- No borrar `resend._domainkey`, `send`, `rsend` ni `_dmarc`: el acuse y el aviso interno dejarían de autenticarse.
- Un segundo SPF en el apex (en vez de unirlos en uno) rompe SPF. El de Resend no va en el apex.
- No activar a la vez el MX de Email Routing y el MX de Google o Zoho.
- La clave nueva de Resend solo vive en Gmail. Si se filtra, se rota en Resend; no se commitea.

## 6. Criterios de aceptación

- [ ] Email Routing activo. MX del apex en `route1` / `route2` / `route3.mx.cloudflare.net`.
- [ ] Un solo SPF en el apex, con `include:_spf.mx.cloudflare.net`. DKIM de Resend y `_dmarc` iguales que antes.
- [ ] Apex y `www` siguen Proxied. `send` y `rsend` siguen DNS-only.
- [ ] Un correo externo a `hola@galladev.com` llega a `ociel.galla@gmail.com`.
- [ ] Una respuesta desde Gmail como `hola@galladev.com` sale por Resend y SPF, DKIM y DMARC pasan.
- [ ] La clave de Gmail no es la de Vercel y no está en git.
- [ ] El acuse del formulario sigue saliendo (envío de Resend intacto).

## 7. Preguntas abiertas para Ociel

1. ¿Qué direcciones? `hola@` está claro. ¿También `ociel@`, `contacto@`, `facturas@`?
2. ¿Catch-all sí o no?
3. ¿Se confirma la opción A, o se pasa a B (Workspace) ya?

Hasta que Ociel responda, el plan del lunes prepara solo `hola@` y no crea catch-all.
