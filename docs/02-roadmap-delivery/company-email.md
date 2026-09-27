# Company Email (galladev.com) — Urgent Priority

> **Status:** documented, not configured · **Urgent priority — Monday 28 Sep 2026**
> **Updated:** 2026-09-27 · Spanish spec (canonical): [`company-email.es.md`](./company-email.es.md)
> **Recommendation, pending Ociel’s decision:** A for now (cost 0). B when there are clients or a team.

Ops note only. No code change. In-platform email management in GDW stays backlog, with no spec.

## 1. Problem and goal

GallaDev **sends** transactional mail from `hola@galladev.com` and **cannot receive** it. There is no company mailbox. Replies to the form acknowledgement go nowhere. Nobody can answer as `hola@` (or as `ociel@`, if wanted).

Monday’s goal: receive and reply as `@galladev.com` while Resend keeps sending as it does today. Apex and `www` stay Proxied. The client-portal weekly PDF (Resend) stays a spec: [`client-portal.es.md`](./client-portal.es.md).

## 2. Current state

Facts as of 27 Sep 2026. No secret values.

Resend verified `galladev.com` on 18 Sep 2026. Return-path uses `send`, so the **apex has no MX yet**.

| Record | Name | Target / content | Proxy | Role |
| --- | --- | --- | --- | --- |
| Web (apex) | `galladev.com` | website | Proxied (orange) | Web |
| Web | `www` | website | Proxied (orange) | Web |
| TXT | `resend._domainkey` | Resend DKIM (value stays in Cloudflare) | DNS only | Resend DKIM |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | DNS only | Resend |
| CNAME | `send` | `send.forge.rmta.net` | DNS only | Resend return-path |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DNS only | DMARC `p=none` |

Resend SPF lives on `send`. After Monday the apex has **one** SPF TXT (section 4).

Landing form → `POST /api/ingest/lead` on `workspace.galladev.com` (Vercel) → Resend sends the visitor ack and the internal notice from `hola@galladev.com` to `ociel.galla@gmail.com`. End-to-end passed 18 Sep 2026.

| Vercel variable | Role |
| --- | --- |
| `EMAIL_FROM_CLIENTS` | From address for clients |
| `EMAIL_NOTIFY_TO` | Internal notice (currently `ociel.galla@gmail.com`) |
| `RESEND_API_KEY` | Sending-only key for the app. A different key goes in Gmail |

## 3. Options

| | A. Cloudflare Email Routing + Gmail | B. Google Workspace | C. Zoho Mail |
| --- | --- | --- | --- |
| Cost | 0 for routing. “Send as” spends Resend quota. | Paid per user/month. Business Starter, official page checked 27 Sep 2026 ([Business editions](https://knowledge.workspace.google.com/admin/getting-started/editions/business-editions), updated 2026-09-24 UTC): Flexible **USD 8.40** / user / month; Annual/Fixed-Term **USD 7** / user / month, or the local-currency equivalent. EUR: see the current price there. | Free plan, Zoho help updated 2 Sep 2026 ([Subscription](https://www.zoho.com/mail/help/adminconsole/subscription.html)): up to 5 users, one domain, 5 GB/user, web only, selected data centers only. Mail Lite and Mail Premium are paid. USD/EUR amount: **see the current price** on [Zoho’s pricing page](https://www.zoho.com/mail/zohomail-pricing.html). |
| Effort | Low | Medium (Google MX on the apex) | Medium (Zoho MX on the apex) |
| Pros | Fits this stage. Mail lands in the Gmail already in use. Resend stays the transactional sender. | Real mailbox when there are clients or a team. | Domain mailbox. Free tier may be enough where it is offered. |
| Cons | Forwarding, not a hosted mailbox. Outbound “as `hola@`” depends on Resend SMTP and its limits. | Monthly per-user cost. Must keep Resend’s records. | Free tier has no IMAP/POP or forwarding. It may be unavailable in the EU. |
| DNS risk | Low if the apex has a single SPF. Routing adds MX `route1/2/3.mx.cloudflare.net` plus one apex SPF (`include:_spf.mx.cloudflare.net`). Resend SPF stays on `send`. DKIM, `_dmarc`, and orange web records stay. | Medium. Google MX replaces any other apex MX. Do not also enable Cloudflare Email Routing. Leave Resend DKIM and `send` / `rsend` alone. | Medium. Zoho MX on the apex cannot share the apex with Cloudflare Email Routing. Same single-SPF rule. |

Resend sending limits (27 Sep 2026, [resend.com/pricing](https://resend.com/pricing)): Free is 3,000 emails/month and 100/day. Pro starts at USD 20/month for 50,000/month.

**Recommendation, pending Ociel’s decision:** A on Monday. B when there are clients or a team.

## 4. Monday plan (option A)

Do Cloudflare and Resend panel steps on **Ociel’s EU PC**.

1. **Enable Email Routing** (Ociel). It adds apex MX `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net` and an SPF TXT. The apex ends with **one** SPF record containing `include:_spf.mx.cloudflare.net`. Leave DKIM, `send`, `rsend`, `_dmarc`, and proxied web records as in section 2. Check: three MX records, one apex SPF.
2. **Destination and rules** (Ociel). Verify `ociel.galla@gmail.com`. Rule `hola@` → that Gmail. `ociel@` and catch-all wait on section 7; catch-all stays off until then.
3. **Gmail “Send mail as”** `hola@galladev.com` (Ociel; the agent never sees the key). New **sending-only** Resend API key, not the Vercel `RESEND_API_KEY`. SMTP `smtp.resend.com`, port **465** or **587**, username `resend`, password = that new key. Ociel pastes it only in Gmail. Check: Gmail marks the address confirmed (the confirmation arrives via the `hola@` forward).
4. **Reply-To on transactional mail** — follow-up **code** task, not this PR (agent, after the mailbox receives). Point replies at `hola@galladev.com`. Optional env name `EMAIL_REPLY_TO` is already in the README; the value stays out of git.
5. **Tests** (Ociel sends; the agent can read a pasted “Show original” with no secrets). External mail to `hola@` arrives in Gmail. A reply sent as `hola@` passes SPF, DKIM, and DMARC (mail-tester or Gmail “Show original”). The landing ack and internal notice still send.
6. **DMARC later** (Ociel, after 2–4 weeks of clean reports): `p=none` → `p=quarantine`. Optional `rua`. Not a Monday blocker.

## 5. Risks and rollback

One apex SPF. Do not edit Resend DKIM, `send`, `rsend`, `_dmarc`, or the orange web records. One MX set on the apex. A new sending-only key in Gmail only; revoke that key if it leaks. Catch-all waits for an explicit yes.

**Rollback:** disable Email Routing so Cloudflare removes the MX it added. Confirm the apex is back to its previous MX state and the apex SPF is not left half-merged. Leave web and Resend records untouched.

## 6. Acceptance checklist

- [ ] Email Routing on; apex MX are `route1/2/3.mx.cloudflare.net`.
- [ ] Single apex SPF including `include:_spf.mx.cloudflare.net`.
- [ ] Resend DKIM, `send`, `rsend`, and `_dmarc` `p=none` unchanged; apex and `www` still Proxied.
- [ ] `ociel.galla@gmail.com` verified; `hola@` forwards there; extra addresses and catch-all match section 7.
- [ ] Gmail sends as `hola@` via Resend SMTP with a new sending-only key.
- [ ] External mail to `hola@` arrives; a reply as `hola@` passes SPF, DKIM, and DMARC.
- [ ] Landing ack and internal notice still go out through Resend.
- [ ] Reply-To remains a later code task.

## 7. Open questions for Ociel

1. Which addresses on Monday? `hola@` is in the plan. Also `ociel@`, `contacto@`, `facturas@`?
2. Catch-all: yes or no?
3. Option A (this plan) or B (Google Workspace)? The written recommendation is A now and B once there are clients or a team, still pending your decision.
