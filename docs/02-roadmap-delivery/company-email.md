# Company Email (galladev.com) — Correo Module in GDW

> **Status:** implemented (Phases 1–3 + dual mailbox V1) · **Decision:** Ociel, 29 Sep 2026 · **Implemented:** 30 Sep 2026 · **Dual mailbox:** 30 Sep 2026.
> This replaces the 27 Sep 2026 recommendation (Cloudflare Email Routing plus Gmail “Send mail as”, and the Google Workspace / Zoho alternatives). That path is not the plan. No Gmail. No Google Workspace.
> `hola@galladev.com` and `ociel@galladev.com` receive and send mail through Resend. The Correo module (`/correo`) is a unified inbox with a mailbox filter. ES: [`company-email.es.md`](./company-email.es.md).

This comes before the login “What is it?” section and before pending M2 work (CodeQL, Viewer E2E 403, distributed rate limiting, audit trail, and the Notion mock cleanup in `tests/mocks/handlers.ts`).

## 1. Decision

Product allowlist: `hola@galladev.com` (company) and `ociel@galladev.com` (personal). No catch-all. No other local-part (`contacto@`, `facturas@`, etc.) is a mailbox.

Inbound and outbound both go through Resend. Inbound is [Resend Inbound](https://resend.com/docs/dashboard/receiving/introduction) (receiving): an MX record on `galladev.com` pointing at Resend, and Resend sends one webhook per received email.

The inbox is the **Correo** module inside GDW (`/correo`). It reuses auth, RBAC, and Supabase. It is not a separate app. That route is not the `/email` workbench (lead drafts). `/email` stays as it is.

V1 UI: one unified inbox, filter `All | hola@ | ociel@`, per-thread chip, reply From = thread `mailbox_address`, **Nuevo** (compose via Resend) and **Borradores** pill (`email_drafts`). No Inbox/Sent/Spam folders. No Gmail.

| Topic | Decision |
| --- | --- |
| Addresses | `hola@galladev.com` and `ociel@galladev.com`. |
| Catch-all | No. |
| Providers dropped | Gmail, Google Workspace, Cloudflare Email Routing, Zoho. |
| Transport | Resend for inbound and outbound. |
| Product | Correo module in GDW (`/correo`), unified inbox + filter. |

Resend’s receiving MX accepts every local-part on the domain ([custom domains](https://resend.com/docs/dashboard/receiving/custom-domains)). The product rule is the allowlist. The webhook stores a message only when `to`, `cc`, or `bcc` includes `hola@` or `ociel@`. Any other recipient is not stored. The handler still returns success after a valid signature.

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
| Mailbox | `/correo` receives at `hola@` and `ociel@` (allowlist). Column `email_threads.mailbox_address`. UI filter + chip. Reply From = thread mailbox. Dual mailbox V1, 30 Sep 2026. Compose + new-message drafts (`email_drafts`, Nuevo button), 30 Sep 2026. |
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
| `RESEND_API_KEY` | Resend API key with **full access**. Required for sending and for the Receiving API (`GET /emails/receiving/{id}`: HTML/text body and headers). A `sending_access`-only key returns 401 on received reads and bodies stay empty. A dedicated full-access key may be stored in Vercel under the same name; it is not committed. |

`EMAIL_FROM_CLIENTS` and `EMAIL_NOTIFY_TO` stay as they are. They are the existing transactional send, not the inbox.

### Body backfill (Phase 0)

If messages were stored without bodies (e.g. key lacked read permission), after setting a full-access `RESEND_API_KEY` and redeploying, an Admin can backfill bodies from Resend (~30-day retention):

```bash
# Admin session cookie. Optional body: {"limit":100} (1–500).
curl -X POST "https://workspace.galladev.com/api/email/backfill-bodies" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d '{"limit":100}'
```

The route requires `requireAdmin`, is idempotent (only inbound rows with null `body_html` and `body_text`), and returns `{ ok, scanned, updated, skipped, failed }`. Repeat until `scanned: 0` or `updated: 0` with a stable `failed` count. It does not log bodies or addresses.

### Attachments (download)

`GET /api/email/attachments/[id]` (`email_attachments` UUID, Admin only) asks Resend for a temporary signed URL (`emails.receiving.attachments.get`, or `emails.attachments.get` for outbound) and returns it as JSON. It does not proxy the file or expose the API key. If Resend no longer has the email (~30 days), it responds 410. The thread view opens PDF/image in a new tab and downloads other types.

## 5. Phases

All three phases are implemented (PR #65, 30 Sep 2026). DNS, webhook, SQL migration, and environment variables are configured.

### Phase 1 — Receive

**Scope.** Enable Resend inbound for `hola@galladev.com`. Ociel publishes the MX in Cloudflare. A Next.js route verifies the webhook and stores the message.

Route: `src/app/api/email/inbound/route.ts` (the App Router lives under `src/app`; the shape is `app/api/email/inbound/route.ts`).

- Reject anything that is not a verified `email.received` event.
- Keep only mail for the allowlist (`hola@` or `ociel@`). No catch-all row. Persist `mailbox_address` on the thread (`src/lib/email/mailboxes.ts`).
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
- [x] A message to any other `@galladev.com` address (outside the allowlist) is not stored. (test: `inbound-verify.test.ts`)
- [x] A message to `ociel@galladev.com` is stored with `mailbox_address = ociel@…`. (dual allowlist; tests `mailboxes.test.ts`, `inbound-verify.test.ts`)
- [x] RLS: an Admin session can read the row; a role that is not allowed cannot. No secret is in git. (`email_threads_admin_read` policy)

### Phase 2 — Inbox UI

**Scope.** `/correo` inside GDW: a thread list, a thread view, read and unread, and a way to link a thread to a lead. It uses the existing session and RBAC. Access is Admin by default. Which other roles can open it is an open question (section 7); until that is answered, Seller, Viewer, and the visitor demo do not see the inbox (same idea as other Admin-only areas: the demo already redirects `/email`).

**Acceptance.**

- [x] An Admin opens `/correo`, sees threads (filter All / hola@ / ociel@), opens one, and the unread marker clears when the thread is read. (`InboxPage`, chip, `ThreadView`)
- [x] The Admin can attach a thread to an existing lead, and the link is still there on reload. (`LinkLeadDialog`, `PATCH /api/email/threads/[id]`)
- [x] A signed-out user, a visitor demo session, and a role that is not allowed do not get the thread list or the message bodies. (`gate.ts` blocks `/correo` and `/api/email/threads`; RLS Admin-only)
- [x] HTML from the message is sanitized on the server when it is stored and again when it is served (`sanitize-html` in `src/lib/email/sanitize-email-html.ts`). The view renders it in a sandboxed iframe with no scripts. Remote images are not loaded.

### Phase 3 — Reply

**Scope.** From the open thread, an allowed user replies through Resend as the thread’s `mailbox_address` (`hola@` or `ociel@`). Threading follows Resend’s reply guide: set `In-Reply-To` to the `message_id` being answered, and set `References` to the earlier `message_id` values in the thread plus that one, separated by spaces. The subject keeps the thread (`Re:` plus the subject). The outbound message is stored on the same `email_threads` row, with its Resend id, so a later inbound reply joins the same thread.

**Acceptance.**

- [x] The reply leaves as the thread mailbox through Resend (`GallaDev <hola@…>` or `Ociel <ociel@…>`), and SPF, DKIM, and DMARC still pass. (`send-reply.ts`, test: `send-reply.test.ts`)
- [x] The sent payload includes `In-Reply-To` and `References` built from the stored `message_id` values. (test: `send-reply.test.ts`)
- [x] The reply is visible in that thread in `/correo` after send, including a failed send marked as failed rather than dropped. (`send_status` column: `delivered` / `failed`)
- [x] A follow-up from the outside to that thread is stored on the same thread, not as a new one, when the incoming `message_id` / `References` match. (`findOrCreateThread` in `inbound-store.ts`)

### Automatic thread ↔ lead linking (improvement 6, 20 Nov 2026)

**Migration** `20261120150000_email_thread_lead_link_source.sql` (apply by hand in the SQL editor **before** deploying): adds `email_threads.lead_link_source` (`'manual' | 'auto' | NULL`, with a CHECK) and marks existing links as `manual`. RLS and grants unchanged (thread SELECT/UPDATE Admin only, FORCE RLS). No new environment variables.

**When it links.** When an **inbound** message is stored (webhook), when a new message is **sent** (compose) and when a thread is **replied** to (`autoLinkThread` in `src/lib/email/lead-link.ts`). Forwarding does not link (the recipient is a third party). If the thread already has a lead, nothing happens.

**Rule.**

1. Candidate addresses = sender + To + Cc (inbound) or To + Cc (outbound), normalized (lower-case, no spaces, `Name <a@b>` → `a@b`), excluding our mailboxes (`hola@`, `ociel@`) and de-duplicated (`lead-match.ts`).
2. Looks up **non-archived** leads whose `email`, `email_commercial` or `email_manager` matches exactly (normalized on both sides; the DB only pre-selects with `ilike`).
3. **Exactly one lead** → linked with `lead_link_source = 'auto'`. **Several distinct leads** (e.g. two duplicate records with the same email, or a message with two customers in Cc) → not linked, left for manual linking. One lead matching through several emails counts once.
4. **A human decision is never overwritten.** The UPDATE is conditional (`lead_id IS NULL` and source null or `auto`), so even a race with a manual link cannot be overwritten. Linking or **unlinking** from the UI (`PATCH /api/email/threads/[id]` with `lead_id`) stores `lead_link_source = 'manual'`: a thread unlinked by hand is not auto-linked again. Links created before the migration count as manual.
5. Best effort: any error is logged (`warn`, no addresses) and never breaks the webhook or the send.

**Backfill (Admin, idempotent).** `POST /api/email/backfill-lead-links` with `requireAdmin`, 3/min limit and optional body `{ dryRun?, limit? (1–500, default 200), offset? }`. Only walks threads with null `lead_id` and null `lead_link_source`, applying the same rule. Returns `{ ok, dryRun, threadsScanned, linked: [{ threadId, leadId }], ambiguous, noMatch, skipped, nextOffset }`; if `nextOffset` is not `null`, repeat with that `offset`. Try `dryRun: true` first:

```js
await (await fetch("/api/email/backfill-lead-links", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dryRun: true }),
})).json();
```

**UI.**

- Lead record (`LeadDrawer`): an **Emails** section (`LeadEmailsSection`) lists linked threads (subject, snippet, date, message count, “Unread” tag), each linking to `/correo?thread=<id>`, with an **Unlink** button (`PATCH` with `lead_id: null`). Mounted for Admin only (Mail is Admin-only in API and RLS); Seller, Viewer and the visitor demo neither see it nor can call the API (`GET /api/email/threads?lead_id=<uuid>`, `requireAdmin`; Trash excluded).
- `/correo?thread=<uuid>` opens that thread in its folder (Inbox, Archived or Trash); if missing, it shows an error.
- Thread view: the lead tag reads “Linked lead · automatic” (with a tooltip) or “· manual”. The source comes from `GET /api/email/threads/[id]` (`lead_link_source`). After replying, the view resyncs in case the reply linked the thread.

**Acceptance.**

- [x] An inbound message or a send with a single matching lead links the thread as `auto`. (tests: `lead-match.test.ts`, `lead-link.test.ts`, `inbound-store.test.ts`, `send-compose.test.ts`, `send-reply.test.ts`)
- [x] Several candidates do not link; a manual link (or a thread unlinked by hand) is not overwritten; case and spaces do not prevent a match. (`lead-link.test.ts`, `lead-match.test.ts`)
- [x] Backfill with `dryRun`, idempotent, Admin only. (`lead-link-backfill.test.ts`, `backfill-lead-links-route.test.ts`)
- [x] The lead record lists linked threads and can unlink them; Seller/Viewer cannot reach mail. (`lead-emails-section.test.tsx`, `thread-state-routes.test.ts`)
- [x] The thread shows whether the link is automatic or manual; the manual link dialog still works. (`thread-view.test.tsx`, `link-lead-dialog.test.tsx`)

## 6. Risks

- **Spam and abuse.** The MX will attract mail that is not a customer. Enforce a body size limit on the webhook, rate-limit the route, and drop recipients outside the allowlist (`hola@`, `ociel@`). Sanitize HTML before rendering. Do not load remote images by default (tracking pixels and mixed-content surprises).
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

## 8. Future: folders (partial)

**Today.** Correo is a **per-thread timeline** plus **new-message drafts** (`email_drafts`, Borradores pill). Gmail-like dense list (sender, subject, last-message snippet, short date, attachment clip, bold when unread), filterable by `mailbox_address`. **Inbox / Sent / Archived / Trash** views (Sent: PR #106) with unread counts per view and on the Correo sidebar entry, and “Load more” pagination (50). Read/unread, archive, trash and restore, single or bulk via checkboxes. Compose/reply via Resend. No Spam folder. **Reply drafts** on an open thread exist (`email_drafts.thread_id`, per-thread autosave; see the Spanish spec, Phase 3). Compose, reply and forward support Cc/Bcc, a per-mailbox signature and outbound attachments (see the Spanish spec, «Redactar: Cc/Cco, autoguardado, firma y adjuntos»). Folder, mailbox and the open thread live in client state, not in the URL: there is a single route, `/correo`. Point 7 in section 9 changes that.

**Folders (Oct 9, 2026).** Migration `20261009180000_email_thread_inbox_state.sql` (apply manually in the SQL editor **before** deploying): `email_threads.archived_at`, `trashed_at`, `last_snippet`, `has_attachments` (the last two kept up to date by triggers, with backfill). RLS unchanged. API: `GET /api/email/threads?view=`, bulk `PATCH /api/email/threads`, `PATCH /api/email/threads/[id]` (`archived`, `trashed`), `GET /api/email/threads/unread-count`, all `requireAdmin` + zod. **Trash purge (PR #106):** the `GET /api/cron/retention` cron counts (and, if `RETENTION_ENABLED=true`, deletes) threads whose `trashed_at` is older than 30 days. The migration `20261118220000_purge_trashed_email_threads.sql` must have been applied by hand. Without that variable the cron stays in dry-run and only reports counts.

**Search (Oct 10, 2026).** Migration `20261010090000_email_search.sql` (apply manually **before** deploying): generated `search_tsv` tsvector columns + GIN indexes on `email_messages` (subject + sender + `body_text`) and `email_threads`. `GET /api/email/threads?q=…&scope=view|all` (max 200 chars) builds a safe prefix tsquery and uses PostgREST `textSearch` (`spanish`). UI: debounced search box, clear button, "search all folders". No `unaccent`; max 200 threads per search.

**Design path (when taken up).** Proposed vocabulary:

| Folder | Idea | Design notes |
| --- | --- | --- |
| Inbox | Threads with recent inbound / not archived | Default view; do not confuse with the address filter (`hola@` / `ociel@`). |
| Sent | Messages or threads with outbound | May be a filter/view on `email_messages.direction = outbound`, not necessarily another table. |
| Spam | Unwanted mail | Needs a source: manual mark and/or provider signal. Today only off-allowlist is dropped. |
| Drafts | Unsent replies or messages | **Done (partial):** new messages and per-thread reply drafts in `email_drafts` (no stored attachments). Do not mix with `/email` (lead drafts). |
| Archive (optional) | Threads out of Inbox without delete | Column or flag on `email_threads`, not a physical folder. |

**Constraints.**

- Do not reuse `/email` or its lead-draft model for mailbox reply drafts.
- The `mailbox_address` filter (allowlist) is orthogonal to folders: an `ociel@` thread can sit in Inbox or Sent.
- Spam and attachment retention remain open (section 7).
- Start criterion: only after dual mailbox V1 is validated in real use.

## 9. Inbox improvements (points 1–7)

These improvements were agreed with Ociel after Phases 1–3. The work order was 1, 2, 3, 5, 6, 7, 4.

| Point | Scope | Status |
| --- | --- | --- |
| 1 | Pagination / “Load more” (pages of 50) | Done (PR #106) |
| 2 | Real Trash purge after 30 days (retention cron) | Done (PR #106; migration `20261118220000_purge_trashed_email_threads.sql`) |
| 3 | Sent folder (threads with at least one `outbound` message that are not in Trash) | Done (PR #106) |
| 4 | Persist inbound attachments in Storage when `EMAIL_ATTACHMENTS_BUCKET` is set | Done (PR #106) |
| 5 | Cc/Bcc, autosave, per-mailbox signature and outbound attachments | Done (PR #108; see the Spanish spec, «Redactar: Cc/Cco, autoguardado, firma y adjuntos») |
| 6 | Automatic thread↔lead linking, auto/manual source, and a “Correos” section on the lead record | In [PR #109](https://github.com/GallaGit/GallaDev_workspace/pull/109), not merged yet |
| 7 | Refresh the list when new mail arrives; per-folder routes; dedicated email sidebar; Cuentas; mobile layout | **Documented, pending implementation** (detail below) |

### Point 7 — Per-folder routes, email sidebar, Cuentas, and mobile layout

**Status:** Documented, pending implementation.

#### Problem

On mobile, the left panel of `/correo` (fixed 320 px width: Recibidos, Enviados, Archivados and Papelera, the mailbox filter, Borradores, and the thread list) shares a row with the reading view and is never hidden. On a narrow screen it covers the open email or leaves almost no room for it. There is no full-width list screen and no back button.

#### Current state (code; this document does not change it)

- The module route is **`/correo`**: a single page (`src/app/correo/page.tsx` → `InboxPage`), with no folder segments. The lead-draft workbench, `/email`, is not part of this module and is left alone.
- Folders have no URL. They live in client state: `view` is `inbox` / `sent` / `archived` / `trash` (`THREAD_VIEWS` in `src/lib/email/thread-state.ts`). Drafts is a separate `listMode` (`drafts`): today a button next to the mailbox chips, not an entry in that view list.
- UI labels (es): Recibidos, Enviados, Archivados, Papelera, Borradores. There is no Spam folder.
- The account filter is also client state (`All` / `hola@` / `ociel@`; allowlist `COMPANY_MAILBOXES` in `src/lib/email/mailboxes.ts`). The API already accepts `GET /api/email/threads?view=&mailbox=`.
- The sidebar (`src/components/layout/app-sidebar.tsx`) has a single “Correo” entry pointing at `/correo`, with the Recibidos unread badge. It does not expand. On mobile the app menu is a drawer (`md` breakpoint, 768 px).
- Access remains Admin-only (APIs use `requireAdmin`, plus RLS). There is no per-mailbox ACL: an Admin sees both `hola@` and `ociel@`. Seller, Viewer and the visitor demo do not use the inbox (the nav entry is hidden from the visitor; the APIs return 403).
- Unread counts refresh every 60 s, when the tab becomes visible, and on the `correo:unread-changed` event. **The thread list does not reload on its own** when new mail arrives.

#### Requirements

**Per-folder routes.** Each existing folder has its own address, with Spanish slugs (like the rest of the app’s routes) in every UI locale:

| Folder | Current view | Route |
| --- | --- | --- |
| Recibidos (Inbox) | `view=inbox` | `/correo/recibidos` |
| Enviados (Sent) | `view=sent` | `/correo/enviados` |
| Archivados (Archived) | `view=archived` | `/correo/archivados` |
| Papelera (Trash) | `view=trash` | `/correo/papelera` |
| Borradores (Drafts) | `listMode=drafts` | `/correo/borradores` |

The prefix is **`/correo`** (singular), confirmed by Ociel. Permanent redirects (308 or the Next.js equivalent):

- `/correo` → `/correo/recibidos`
- any other path under `/correo/…` that is not a known folder → the matching folder, or `/correo/recibidos` if there is no match

No Spam folder is added. `/email` is not redirected. The new routes join the same access lists as `/correo` (safe redirect after login, hidden from the visitor, Admin only).

The default folder is Recibidos. An open thread is shareable and survives a reload: `/correo/{folder}/{threadId}` (UUID), keeping the account in the query string when it applies. Drafts has no thread path; opening a draft opens the compose view in the content area.

**Email sidebar (full swap).** Entering `/correo/…` replaces the app’s general sidebar completely with a sidebar dedicated to mail. It is not an expandable list of sub-items under the general “Correo” entry. That general-menu entry remains the way into the module; once inside, the general sidebar is no longer on screen.

At the top of the email sidebar is a **Back** button that restores the general sidebar (it returns to the previous page, or to the dashboard if there is no clear previous page).

The email sidebar contains everything except the message body:

- the Back button
- the **Nuevo** button
- the five folders (Recibidos, Enviados, Archivados, Papelera, Borradores), with the existing unread badge on each, when it applies
- **Cuentas** (Todas / All, `hola@`, `ociel@`)
- the thread list (or draft list) for the selected folder and account
- search, next to the list

The main wide area shows **only** the open thread’s content, the compose view, or an empty state (for example “Select a message”). That area has no second column for the list or the folders.

**Desktop** (`md` and up, 768 px): the email sidebar and the content area are visible at the same time. Changing folder or account updates the list in the sidebar and the URL; the wide area changes only when a thread is opened, compose starts, or there is no selection.

**Cuentas.** In the email sidebar, **Cuentas** expands to:

- Todas (All)
- `hola@` (local-part of `hola@galladev.com`)
- `ociel@` (local-part of `ociel@galladev.com`)

If the allowlist later gains more mailboxes, they appear here. The account combines with the folder: filtering by `hola@` in Recibidos does not leave Recibidos.

Account selection uses a **query parameter** `cuenta`, not a path segment. Values: omit it or use `todas` for every visible mailbox; `hola` or `ociel` (the local-part) for one mailbox. Example: `/correo/recibidos?cuenta=hola`. An unknown or disallowed value is treated as Todas (or redirected to the URL without `cuenta`).

Why a query and not `/correo/hola/recibidos`: folder and mailbox are already orthogonal axes (section 8 and the API’s `mailbox` filter). That avoids a combinatorial route tree, changing account does not lose the folder or the thread, and “Cuentas” in the email sidebar is a filter, not a destination page. The client maps `cuenta` to the `mailbox` parameter that `GET /api/email/threads` already understands.

**Permissions.** This work does not invent a new per-mailbox RBAC. Today only Admin can enter, and Admin sees both accounts. Cuentas lists only the mailboxes that session may see. A URL with `cuenta` set to a mailbox that is not allowed must not return those threads (403 or a redirect to Todas / an allowed mailbox). If other roles later gain access to Correo or to a single mailbox (open question in section 7), this filter respects that.

**Mobile** (below `md`, 768 px, the same cut-off as the general menu drawer): the split is the same as on desktop (email sidebar / content), but the two are not shown at the same time.

- The email sidebar is the full-width screen: Back, Nuevo, folders, Cuentas and the list. The message body is not visible at the same time.
- Opening a thread shows the content full screen, with a **Back** button that returns to the email sidebar (same folder, same account, and, when reasonable, the same scroll position).
- **Back** at the top of the email sidebar restores the app’s general menu (previous page or dashboard).
- **Nuevo** opens the compose view full screen, also with Back to the email sidebar.

**Refresh the list when new mail arrives** (the original scope of point 7; it stays). If a new message belongs to the folder and account being viewed, the list updates without a manual page reload and without losing the selection, the scroll position, or an open thread. Unread badges in the email sidebar update as well, even if the message lands in another folder. The interval is **every 60 s**, the same as the counters, and also when the tab becomes visible and on the `correo:unread-changed` event. This delivery does not require a WebSocket. It does not replace an out-of-app notification (that remains question 3 in section 7).

#### Acceptance criteria

- [ ] An Admin opens `/correo/recibidos`, `/correo/enviados`, `/correo/archivados`, `/correo/papelera` and `/correo/borradores`, and sees the folder the URL names. Reloading or sharing the URL keeps the folder.
- [ ] `/correo` redirects to `/correo/recibidos`. `/email` is unchanged.
- [ ] Entering Correo replaces the general sidebar with the email sidebar (Back, Nuevo, the five folders, Cuentas and the list). The wide area shows only the open thread, the compose view, or an empty state.
- [ ] Back at the top of the email sidebar restores the app’s general sidebar (previous page or dashboard).
- [ ] Choosing a folder navigates to its route. Choosing Todas / hola@ / ociel@ applies the filter and stays on the current folder, with `?cuenta=` in the URL (Todas may omit the parameter).
- [ ] `?cuenta=hola` on Recibidos lists only threads for `hola@galladev.com`. The filter can be combined with the existing search.
- [ ] Seller, Viewer and the visitor demo do not see the new routes or their APIs (same rule as `/correo`). A visitor does not see “Correo” in the general menu.
- [ ] On desktop (`md` and up), the email sidebar and the content area are visible at the same time; the list is not in the wide area.
- [ ] Below 768 px, the email sidebar (folders and list) is full screen. Opening a thread shows the content full screen, with Back to the email sidebar. Back on that sidebar returns to the app’s general menu.
- [ ] With the inbox open, a new email that belongs in the current view appears in the list within 60 s (the same pace as the counters; also when the tab becomes visible), and badges update, without a manual reload.
- [ ] `/email` is untouched, Spam is not added, and the permission model is unchanged beyond applying the existing one to the new routes.

#### Out of scope

- A Spam folder, out-of-app notifications when mail arrives, and which roles besides Admin can see the inbox (they remain in section 7).
- A dedicated route for “Nuevo mensaje” (compose opens in the content area, without its own URL).
- Changing the API (`view`, `mailbox`) beyond what the new URLs need.
- Point 6 work (PR #109) and any other compose or linking improvement.
