# Company Email (galladev.com) — Urgent Priority

> **Status:** specified, not implemented · Ociel marked this the urgent next step on 27 Sep 2026 · **For:** Monday 28 Sep 2026
> **Recommendation, pending Ociel’s decision:** option A (Cloudflare Email Routing).
> Do not present this as current behavior. Nothing receives mail at `@galladev.com` today. ES: [`company-email.es.md`](./company-email.es.md).

This comes before the login “What is it?” section and before pending M2 work (CodeQL, Viewer E2E 403, distributed rate limiting, audit trail, and the Notion mock cleanup in `tests/mocks/handlers.ts`).

## 1. Problem and goal

Receive and reply as `@galladev.com` (`hola@`, and `ociel@` if Ociel wants it) without breaking Resend.

The domain sends. It does not receive. A reply to the form acknowledgement goes to `hola@galladev.com` and reaches nobody.

Out of this step: the client-portal weekly PDF (still in [`client-portal.es.md`](./client-portal.es.md), not implemented) and in-platform email management inside GDW (roadmap placeholder, no spec).

## 2. Current state

Facts as of 27 Sep 2026. No secret values.

| Piece | Fact |
| --- | --- |
| Domain | `galladev.com`. DNS on Cloudflare. |
| Web | Apex and `www` are Proxied (orange cloud). Leave them. |
| Resend | Domain `galladev.com` **Verified** on 18 Sep 2026. |
| Sending | Landing form → `POST /api/ingest/lead` on `workspace.galladev.com` (Vercel) → Resend. Visitor ack and internal notice. From `hola@galladev.com`. Notice to `ociel.galla@gmail.com`. That send E2E passed on 18 Sep. |
| Vercel | `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO`, and `RESEND_API_KEY` (sending-only key) are set. |
| Code | `EMAIL_REPLY_TO`, when set, is sent as Reply-To (`src/lib/email/resend-client.ts`, `send-ingest-emails.ts`). It is not in the Vercel list above. |
| Gap | There is no real company mailbox. Nobody can receive at `hola@galladev.com` or reply from it as a person. |
| Apex MX | The apex has no MX yet. Resend uses the `send` subdomain as its return-path. |

Mail DNS to leave alone (DNS-only, not Proxied):

| Type | Name | Target or value | Role |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | (Resend DKIM; value not copied here) | Resend DKIM |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` | Resend |
| CNAME | `send` | `send.forge.rmta.net` | Resend return-path |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC, policy `none` |

Resend’s SPF lives on `send`, not on the apex.

## 3. Options

| | A. Cloudflare Email Routing | B. Google Workspace | C. Zoho Mail |
| --- | --- | --- | --- |
| Cost | 0 | Paid per user per month. Business Starter, Google’s table checked 27 Sep 2026: flexible 8.40 USD / 8.10 EUR; annual 7 USD / 6.80 EUR. [Plan comparison](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans). Tax and country can change the figure. | Free plan in selected data centers: up to 5 users, one domain, 5 GB per user, web access (no IMAP/POP/ActiveSync). [Subscription](https://www.zoho.com/mail/help/adminconsole/subscription.html), [pricing](https://www.zoho.com/mail/zohomail-pricing.html) (27 Sep 2026). Paid Mail Lite (5 GB / 10 GB): **see the current price** on that page; it depends on region and billing cycle. |
| Effort | Low. Forward to the Gmail account that already exists, plus Gmail “Send mail as”. | Medium. User signup, apex MX, admin console. | Medium. Same as B, plus whether the free plan exists in that account’s data center. |
| Pros | Cost 0. Fits this stage. Mail lands in `ociel.galla@gmail.com`. Reply as `hola@` through Resend SMTP. Does not move the website or Resend DKIM. | A real mailbox, calendar, and more users when there are clients or a team. | A real mailbox, cheaper than Workspace if the current price stays low. The free plan avoids a fee at the start. |
| Cons | Not a mailbox with its own storage: it is forwarding. “Send mail as” depends on Resend and Gmail. Resend’s free or paid sending limits apply; figures are not copied here. | A monthly fee from day one. The apex MX has to change. | The free plan has no IMAP/POP and is not in every region. The paid plan adds another vendor. It also wants MX on the apex. |
| DNS risk | Low if the apex ends with **one** SPF record (`include:_spf.mx.cloudflare.net`) and DKIM, `_dmarc`, `send`, `rsend`, and the Proxied web records stay untouched. | New MX on the apex. Do not combine it with Email Routing’s MX. Do not touch Proxied web records or Resend’s records. | Same as B. |

**Recommendation, pending Ociel’s decision:** A for now (cost 0, fits the current stage). B when there are clients or a team.

## 4. Monday 28 Sep 2026 plan (option A)

Cloudflare and Resend panel steps happen on Ociel’s EU PC.

1. **Turn on Email Routing.** Owner: Ociel. Cloudflare → Email → Email Routing. Enabling it adds MX `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, and `route3.mx.cloudflare.net`, plus an SPF TXT on the apex. Check: the apex ends with **one** SPF record, including `include:_spf.mx.cloudflare.net`. Resend’s SPF stays on `send`. DKIM (`resend._domainkey`) and `_dmarc` stay as they are. Proxied web records stay.
2. **Destination and rules.** Owner: Ociel. Verify destination `ociel.galla@gmail.com`. Rule `hola@galladev.com` → that Gmail. `ociel@` and a catch-all are open questions; do not create them until Ociel says so. Check: the rule shows as active and the destination shows as verified.
3. **Send as `hola@` from Gmail.** Owner: Ociel. Gmail → “Send mail as” → `hola@galladev.com` via Resend SMTP: host `smtp.resend.com`, port 465 or 587, username `resend`, password = a **new** Resend sending-only key. Do not reuse the Vercel key. Ociel pastes it only in Gmail; it does not go into the repo or the chat. Resend’s sending limits apply. Check: Gmail shows the address as added, and the key is not pasted into any document.
4. **Reply-To on transactional mail.** Owner: agent, in a later code change. Not in this PR. The code sends Reply-To only when `EMAIL_REPLY_TO` is set. Once `hola@` can receive, replies to the From address `hola@galladev.com` may arrive on their own. Still to decide: whether Reply-To must be set in Vercel or in code.
5. **Tests.** Owner: Ociel (sends). The agent can read the result if Ociel pastes headers, with no secrets. From an external mailbox, write to `hola@galladev.com` and see it in Gmail. Reply from Gmail as `hola@` and check SPF, DKIM, and DMARC in “Show original” or on [mail-tester](https://www.mail-tester.com/).
6. **DMARC later.** Owner: Ociel. After 2–4 weeks of clean reports, move `p=none` to `quarantine`. An `rua` report address is optional. Not Monday’s work.

## 5. Risks and rollback

- Turning Email Routing off removes the MX records Cloudflare added. Forwarding stops. Web records (Proxied apex and `www`) stay.
- Do not delete `resend._domainkey`, `send`, `rsend`, or `_dmarc`: the acknowledgement and the internal notice would stop authenticating.
- A second SPF record on the apex (instead of one merged record) breaks SPF. Resend’s SPF does not belong on the apex.
- Do not turn on Email Routing’s MX and a Google or Zoho MX at the same time.
- The new Resend key lives only in Gmail. If it leaks, rotate it in Resend; do not commit it.

## 6. Acceptance criteria

- [ ] Email Routing is on. Apex MX is `route1` / `route2` / `route3.mx.cloudflare.net`.
- [ ] One SPF record on the apex, with `include:_spf.mx.cloudflare.net`. Resend DKIM and `_dmarc` unchanged.
- [ ] Apex and `www` still Proxied. `send` and `rsend` still DNS-only.
- [ ] External mail to `hola@galladev.com` arrives at `ociel.galla@gmail.com`.
- [ ] A Gmail reply as `hola@galladev.com` goes out through Resend, and SPF, DKIM, and DMARC pass.
- [ ] The Gmail key is not the Vercel key and is not in git.
- [ ] The form acknowledgement still sends (Resend sending intact).

## 7. Open questions for Ociel

1. Which addresses? `hola@` is clear. Also `ociel@`, `contacto@`, `facturas@`?
2. Catch-all yes or no?
3. Confirm option A, or move to B (Workspace) now?

Until Ociel answers, Monday’s plan prepares `hola@` only and does not create a catch-all.
