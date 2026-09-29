# Company Email (galladev.com) — Correo Module in GDW

> **Status:** implemented (Phases 1–3) · **Decision:** Ociel, 29 Sep 2026 · **Implemented:** 30 Sep 2026.
> This replaces the 27 Sep 2026 recommendation (Cloudflare Email Routing plus Gmail “Send mail as”, and the Google Workspace / Zoho alternatives). That path is not the plan. No Gmail. No Google Workspace.
> `hola@galladev.com` receives and sends mail through Resend. The Correo module (`/correo`) lets users read threads, link them to leads, and reply. ES: [`company-email.es.md`](./company-email.es.md).

This comes before the login “What is it?” section and before pending M2 work (CodeQL, Viewer E2E 403, distributed rate limiting, audit trail, and the Notion mock cleanup in `tests/mocks/handlers.ts`).

## 1. Decision

Only `hola@galladev.com` receives mail. No catch-all. No other local-part (`ociel@`, `contacto@`, `facturas@`) is a mailbox.

Inbound and outbound both go through Resend. Outbound already sends from `hola@galladev.com`. Inbound is [Resend Inbound](https://resend.com/docs/dashboard/receiving/introduction) (receiving): an MX record on `galladev.com` pointing at Resend, set in Cloudflare DNS by Ociel from his EU PC, and Resend sends one webhook per received email.

The inbox is a new **Correo** module inside GDW. It reuses GDW auth, RBAC, and Supabase. It is not a separate app. The page is `/correo`. That route is not the existing `/email` workbench (lead drafts). `/email` stays as it is.

Checked against Resend’s docs on 29 Sep 2026. Inbound receiving is available, so Cloudflare Email Workers is not the fallback.

| Topic | Decision |
| --- | --- |
| Address | Only `hola@galladev.com`. |
| Catch-all | No. |
| Providers dropped | Gmail, Google Workspace, Cloudflare Email Routing, Zoho. |
| Transport | Resend for inbound and outbound. |
| Product | Correo module in GDW (`/correo`). |

Resend’s receiving MX accepts every local-part on the domain it is attached to ([custom domains](https://resend.com/docs/dashboard/receiving/custom-domains)). The product rule is still one address. The webhook stores a message only when `to`, `cc`, or `bcc` includes `hola@galladev.com`. Any other recipient is not stored and does not open a thread. The handler still returns success after a valid signature so Resend does not retry a message GDW chose not to keep.

## 2. Current state

Facts as of 27 Sep 2026, still true on 29 Sep 2026. No secret values.

| Piece | Fact |
| --- | --- |
| Domain | `galladev.com`. DNS on Cloudflare. |
| Web | Apex and `www` are Proxied (orange cloud). Leave them. |
| Resend | Domain `galladev.com` **Verified** on 18 Sep 2026. Sending and receiving active. Inbound enabled 30 Sep 2026. |
| Sending | Landing form → `POST /api/ingest/lead` on `workspace.galladev.com` (Vercel) → Resend. Visitor ack and internal notice. From `hola@galladev.com`. Notice to `ociel.galla@gmail.com`. That send E2E passed on 18 Sep. |
| Vercel | `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO`, `RESEND_API_KEY`, and `RESEND_INBOUND_WEBHOOK_SECRET` are set. |
| Code | `EMAIL_REPLY_TO`, when set, is sent as Reply-To (`src/lib/email/resend-client.ts`, `send-ingest-emails.ts`). It is not in the Vercel list above. |
| Mailbox | The Correo module (`/correo`) receives mail at `hola@galladev.com` and allows replies. Implemented 30 Sep 2026. |
| Apex MX | MX published in Cloudflare (apex, DNS-only) pointing to Resend inbound. |
| Storage | The repo does not use Supabase Storage. No bucket exists. The client-portal spec proposes a private bucket `project-files`; it is not created. |
| `/email` | Lead-draft workbench. Not an inbox. |

Mail DNS to leave alone (DNS-only, not Proxied):

| Type | Name | Target or value | Role |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | (Resend DKIM; value not copied here) | Resend DKIM |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | Resend |
| CNAME | `send` | `send.forge.rmta.net` | Resend return-path |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC, policy `none` |

Resend’s SPF lives on `send`, not on the apex. Do not add a second SPF record on the apex. Do not delete `resend._domainkey`, `send`, `rsend`, or `_dmarc`: the acknowledgement and the internal notice would stop authenticating.

## 3. Inbound on Resend (docs checked 29 Sep 2026)

Sources: [Receiving](https://resend.com/docs/dashboard/receiving/introduction), [custom domains](https://resend.com/docs/dashboard/receiving/custom-domains), [Cloudflare DNS](https://resend.com/docs/dashboard/domains/cloudflare), [`email.received`](https://resend.com/docs/webhooks/emails/received), [verify webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests), [get email content](https://resend.com/docs/dashboard/receiving/get-email-content), [attachments](https://resend.com/docs/dashboard/receiving/attachments), [reply in thread](https://resend.com/docs/dashboard/receiving/reply-to-emails).

**MX.** On the verified domain, turn receiving on. Resend shows the MX host and priority to publish. Ociel adds that record in Cloudflare DNS from his EU PC. The apex has no MX today, so the record goes on `galladev.com` (apex), DNS-only (grey cloud), not Proxied. Resend’s Cloudflare guide (same date) shows the shape: type `MX`, priority `10`, mail server copied from the dashboard (the guide’s example is `inbound-smtp.us-east-1.amazonaws.com`). The dashboard value is the one to publish; do not guess a region. One MX only. Do not combine it with Cloudflare Email Routing or any other provider’s MX.

**Webhook event.** `email.received`. Resend `POST`s once per received email. The body is metadata: `data.email_id` (Resend’s id for that email), `data.message_id` (the RFC `Message-ID`), `from`, `to`, `cc`, `bcc`, `subject`, and attachment metadata (`id`, `filename`, `content_type`). It does not include the HTML body, the plain-text body, the headers, or the attachment bytes.

**Signature.** Svix. Read the raw request body before any JSON parse. Verify with `resend.webhooks.verify`, passing that raw string, the headers `svix-id`, `svix-timestamp`, and `svix-signature`, and the signing secret. A bad or missing signature is rejected (do not store). The secret is never committed.

**Body and files.** After a verified `email.received`, load the message with the Receiving API (`resend.emails.receiving.get(email_id)`) and attachment bytes with the Attachments API. `download_url` expires (about one hour; honor `expires_at`). Idempotency key is the provider message id `data.email_id`. Store `message_id` as well: replies need it for threading.

## 4. Environment variables

Names only. Values stay in Vercel (and in Resend). Never in git, never in this doc.

| Name | Use |
| --- | --- |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Signing secret for the inbound webhook. Resend’s own samples call the same kind of secret `RESEND_WEBHOOK_SECRET`. This spec uses `RESEND_INBOUND_WEBHOOK_SECRET` so it is not mixed up with a later sending-events webhook. |
| `RESEND_API_KEY` | Already set. Reuse it for outbound replies and for the Receiving API (get message, list attachments) when that key is allowed to call them. A dedicated Resend key may be used instead of reusing this one. The dedicated key is also only a Vercel secret; it is not a second name this spec requires, and it is not committed. |

`EMAIL_FROM_CLIENTS` and `EMAIL_NOTIFY_TO` stay as they are. They are the existing transactional send, not the inbox.

## 5. Phases

All three phases are implemented (PR #65, 30 Sep 2026). DNS, webhook, SQL migration, and environment variables are configured.

### Phase 1 — Receive

**Scope.** Enable Resend inbound for `hola@galladev.com`. Ociel publishes the MX in Cloudflare. A Next.js route verifies the webhook and stores the message.

Route: `src/app/api/email/inbound/route.ts` (the App Router lives under `src/app`; the shape is `app/api/email/inbound/route.ts`).

- Reject anything that is not a verified `email.received` event.
- Keep only mail for `hola@galladev.com`. No catch-all row.
- Idempotent on `data.email_id`. A repeat delivery updates nothing and returns success.
- Persist threads and messages in Supabase, for example tables `email_threads` and `email_messages`.
- Attachments: metadata always. Bytes go in a private Storage bucket when one exists. None exists in the repo today (the client-portal spec’s `project-files` is not created). Until a bucket exists, store metadata only. Do not invent a public bucket. Cap each file at 50 MB (52 428 800 bytes), the same cap as the client-portal spec.
- The webhook has no user session. The route writes with the server credential after the signature check. Reads go through the signed-in user and RLS. Only allowed roles can read. Admin is the allowed role until the open question in section 7 is answered.
- Rate-limit the route. The app’s limiter today is in-memory and per instance; this route still needs a limit so a flood cannot fill the table.

**Acceptance.**

- [x] Resend receiving is enabled on `galladev.com`, and the apex MX is the single record Resend showed, DNS-only.
- [x] `send`, `rsend`, DKIM, and `_dmarc` unchanged. The form acknowledgement still sends.
- [x] `POST` to the inbound route with a bad or missing Svix signature does not write a row. (test: `inbound-route.test.ts`)
- [x] A real message to `hola@galladev.com` is stored once. A second delivery of the same `email_id` does not insert a second message. (idempotency on `resend_email_id` UNIQUE)
- [x] A message to any other `@galladev.com` address is not stored. (test: `inbound-verify.test.ts`)
- [x] RLS: an Admin session can read the row; a role that is not allowed cannot. No secret is in git. (`email_threads_admin_read` policy)

### Phase 2 — Inbox UI

**Scope.** `/correo` inside GDW: a thread list, a thread view, read and unread, and a way to link a thread to a lead. It uses the existing session and RBAC. Access is Admin by default. Which other roles can open it is an open question (section 7); until that is answered, Seller, Viewer, and the visitor demo do not see the inbox (same idea as other Admin-only areas: the demo already redirects `/email`).

**Acceptance.**

- [x] An Admin opens `/correo`, sees threads for `hola@`, opens one, and the unread marker clears when the thread is read. (`InboxPage`, `ThreadView`, auto-mark-as-read)
- [x] The Admin can attach a thread to an existing lead, and the link is still there on reload. (`LinkLeadDialog`, `PATCH /api/email/threads/[id]`)
- [x] A signed-out user, a visitor demo session, and a role that is not allowed do not get the thread list or the message bodies. (`gate.ts` blocks `/correo` and `/api/email/threads`; RLS Admin-only)
- [x] HTML from the message is sanitized before it is shown. Remote images are not loaded by default. (`sanitizeHtml` in `thread-view.tsx`)

### Phase 3 — Reply

**Scope.** From the open thread, an allowed user replies through Resend as `hola@galladev.com`. Threading follows Resend’s reply guide: set `In-Reply-To` to the `message_id` being answered, and set `References` to the earlier `message_id` values in the thread plus that one, separated by spaces. The subject keeps the thread (`Re:` plus the subject). The outbound message is stored on the same `email_threads` row, with its Resend id, so a later inbound reply joins the same thread.

**Acceptance.**

- [x] The reply leaves as `hola@galladev.com` through Resend, and SPF, DKIM, and DMARC still pass on the existing sending setup. (`send-reply.ts`, test: `send-reply.test.ts`)
- [x] The sent payload includes `In-Reply-To` and `References` built from the stored `message_id` values. (test: `send-reply.test.ts`)
- [x] The reply is visible in that thread in `/correo` after send, including a failed send marked as failed rather than dropped. (`send_status` column: `delivered` / `failed`)
- [x] A follow-up from the outside to that thread is stored on the same thread, not as a new one, when the incoming `message_id` / `References` match. (`findOrCreateThread` in `inbound-store.ts`)

## 6. Risks

- **Spam and abuse.** The MX will attract mail that is not a customer. Enforce a body size limit on the webhook, rate-limit the route, and drop recipients other than `hola@`. Sanitize HTML before rendering. Do not load remote images by default (tracking pixels and mixed-content surprises).
- **Attachments.** 50 MB per file (52 428 800 bytes), consistent with the client-portal spec. Reject larger files. Attachment `download_url` values expire; fetch during the webhook handling, or store metadata only and accept that the bytes may need a fresh API call. Retention of stored bytes is an open question (section 7).
- **Webhook flood.** Rate-limit `POST` on the inbound route. A failed signature is not a reason to parse or store the body.
- **DNS.** A second MX, or proxying the MX (orange cloud), breaks receiving. Deleting `send`, `rsend`, DKIM, or `_dmarc` breaks the mail that already sends.
- **Secrets.** `RESEND_INBOUND_WEBHOOK_SECRET` and any Resend API key live only in Vercel. If one leaks, rotate it in Resend. Do not commit it.
- **Replay.** Svix verification covers timestamped signatures. Still dedupe on `email_id`.

## 7. Open questions

1. Which roles besides Admin can see the inbox? (Seller, Viewer, neither.)
2. How long are attachment bytes kept, if they are stored at all?
3. Who is notified when new mail arrives, and by what channel?

Until those are answered: Admin only, metadata-only attachments if no bucket exists, and no new-mail notification.
