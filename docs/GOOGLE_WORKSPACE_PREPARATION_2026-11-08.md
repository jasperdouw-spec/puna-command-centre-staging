# Google Workspace — preparation, no activation

Decision record dated 8 November 2026 Vancouver / 9 November UTC. No subscription, tenant, DNS record, administrator, property, OAuth scope or email provider was created or changed.

## Verified access and remaining inventory

The connected personal Google Drive, Gmail and Calendar identities are Jasper's existing personal account. PUNA's established `02 — PUNA Foods / Documentation` folder and its Complete Project & Operations Reference document were found. These connections do not establish a PUNA Workspace tenant. No PUNA-domain Google administrator session is available. Existing Workspace, Cloud Identity, unmanaged accounts, GA4, Tag Manager, Search Console and Business Profile ownership therefore remain unverified, not absent. Windsor's connected inventory contained no PUNA GA4/Search Console/Business Profile connection. Do not create duplicates on that basis.

Before signup, check the intended domain in Google's existing-account/recovery path with the owner; inspect any existing Admin console billing and domain ownership, and preserve data if an unmanaged account must be transferred. Inspect each existing property under Jasper's known accounts before proposing a new one. Search Console may already be verified through another token/owner; Business Profile may need access to an existing listing, not a new public listing. Personal Drive ownership must not be moved automatically when Workspace starts.

## Account, cost and ownership proposal

Propose one Business Starter licensed user, `admin@punaempanadas.ca`, controlled by Jasper, with `hola@punaempanadas.ca` and `orders@punaempanadas.ca` aliases to that mailbox. An alias has no independent login or inbox. José needs a separate licensed user if independent mail/Drive/Calendar access is required; never share the administrator password. Before production, consider a distinct administrator identity and a second recovery administrator with minimum necessary rights; no grants are authorized now.

| Plan | Flexible, CAD/user/month | Annual commitment, CAD/user/month |
| --- | ---: | ---: |
| Business Starter | 11.00 | 9.20 |
| Business Standard | 22.00 | 18.40 |
| Business Plus | 34.40 | 28.70 |

Recommend Starter flexible initially: one seat is CAD132 over twelve months versus CAD110.40 on an annual commitment, before tax, promotions and checkout-specific terms. Annual licenses cannot simply be removed mid-term. Standard/Plus are options only if their additional storage/control features are required. Current official [Google payment-plan comparison](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans) supplies these list prices. Google permits up to 30 aliases per user without extra alias charges; see [alias administration](https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias). Confirm price and billing country at the eventual approval step.

Use two phishing-resistant MFA methods/security keys or passkeys, private offline recovery codes and an owner-controlled external recovery address/phone. Store recovery material in the established private password vault, never the repo or a shared document. Keep billing/domain recovery controlled by Jasper; grant José only the services needed. Use named access, a review/offboarding checklist and an export/recovery rehearsal. No automated ownership transfer.

## Read-only DNS observations

Queried both authoritative nameservers `aster.dns-parking.com` and `helios.dns-parking.com`. Both returned apex A `2.57.91.91`; `www` CNAME `punaempanadas.ca`; staging A `145.223.124.247` and `88.223.87.206`. Apex AAAA, MX, TXT and CAA returned no answers. `_dmarc` and the specifically queried `google._domainkey` returned NXDOMAIN. These are point-in-time public observations, not a full zone export, proof of no mailbox, or proof that other DKIM selectors/providers do not exist.

Complete zone, registrar recovery, email subscriptions, forwarders/catch-all, mailbox contents, historic sending services and all verification selectors remain blocked by Hostinger OAuth reauthentication and lack of an authenticated mail-admin view. Do not overwrite DNS until a full current zone export and mail-sender inventory are reviewed. Preserve web/staging A, CNAME, NS, existing verification and unrelated records.

## Proposed DNS changes — review worksheet, not executable instructions

| Purpose | Host/type | Proposed value | TTL and prerequisite |
| --- | --- | --- | --- |
| Verify tenant | `@` TXT | `google-site-verification=<exact token from the approved tenant>` | 3600; token unavailable until authorized tenant setup |
| Receive Google mail | `@` MX priority 1 | `smtp.google.com.` | 3600; only after mailbox readiness and review of every existing MX |
| Authorize Google sending | `@` TXT | `v=spf1 include:_spf.google.com ~all` | 3600; valid only if Google is the only sender; merge with existing SPF rather than create two SPF records |
| DKIM | `<approved-selector>._domainkey` TXT | `<exact 2048-bit public DKIM value generated in Admin console>` | 3600; exact selector/key pending; do not invent or expose a private key |
| DMARC monitoring | `_dmarc` TXT | `v=DMARC1; p=none; rua=mailto:dmarc@punaempanadas.ca` | 3600; proposed extra alias must first exist, receive mail and have an assigned report reviewer |

There is no honest exact tenant token/DKIM key to provide yet. The other generic values above are exact proposals, conditional on the complete inventory. Transactional providers may later require their own subdomain DKIM/return-path records; those exact values depend on the selected provider and are not included in the Google-only SPF proposal. Do not set quarantine/reject until all legitimate senders are aligned and reviewed.

References: [verification TXT](https://knowledge.workspace.google.com/admin/domains/verify-your-domain-with-a-txt-record), [current Google MX](https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace), [SPF](https://knowledge.workspace.google.com/admin/security/set-up-spf), [DKIM](https://knowledge.workspace.google.com/admin/security/set-up-dkim), [DMARC](https://knowledge.workspace.google.com/admin/security/set-up-dmarc).

After separate authorization: export the exact prior zone and TTLs, create/test accounts and aliases, add verification TXT without replacing unrelated TXT, then stage reviewed mail records. Query both authoritative servers and independent resolvers; verify Google domain/Gmail/DKIM status; send and receive controlled external tests for the primary address and each alias; inspect SPF/DKIM/DMARC alignment and Reply-To; confirm website/staging still resolve. Allow for cached old values; Google notes MX propagation can take up to 72 hours. Record evidence without retaining message contents unnecessarily.

Rollback: restore the exact saved MX and SPF/DMARC/DKIM records and TTLs, removing only records introduced by this change. Keep both old and new mailboxes available during propagation, check both for split delivery, and preserve messages already received by Google. Removing a verification record alone does not close a tenant or restore mail. If there was no working previous mail service, an empty original MX set is not a functioning rollback destination; arrange an approved continuity plan before cutover.

## Separate ChatGPT service connections

| Service | Required connection/access after approval | Current state |
| --- | --- | --- |
| Drive, Docs, Sheets, Slides | Connect the intended PUNA identity to Google Drive and verify file-level access; choose read/write scopes for the requested work | Personal Drive works; PUNA identity not established |
| Gmail | Separate Gmail connection to the intended mailbox; sending remains an explicit authorized action | Personal Gmail read identity verified; no PUNA mailbox connected |
| Calendar | Separate Calendar connection and selected calendar access; inspect availability before scheduling | Personal Calendar verified; no PUNA calendar verified |
| Contacts | Separate Contacts/directory permissions if needed | No PUNA directory verified |
| GA4 | Authorized analytics property access and dedicated supported connector (for example Windsor) | No PUNA connection/property verified |
| Search Console | Separate property ownership/access and supported connector | Unverified |
| Tag Manager | Container-specific access; no current direct GTM tool exposed | Unverified; no container published |
| Business Profile | Existing listing ownership/manager access and a supported connection | Unverified; no listing created/published |

A Workspace subscription or Google login does not automatically connect every service to ChatGPT. Existing personal connections stay unchanged. Do not grant domain-wide delegation or blanket administrator access to solve a single-service connection.

## Transactional email options

Recommend a dedicated transactional provider with a business-owned account and verified sending subdomain, using `orders@` as the customer-facing Reply-To once that inbox is active. Keep marketing separate and disable open/click tracking initially.

| Option | Current published starting point | Tradeoff |
| --- | --- | --- |
| Postmark | Free test plan 100/month; Basic USD15/month at 10,000 emails | Dedicated transactional streams and delivery/bounce reporting; paid floor above a tiny store's likely use |
| Resend | Free 3,000/month with 100/day cap; Pro USD20/month at 50,000 | Convenient API and templates; daily cap needs a peak-volume plan |
| Workspace Gmail API | Uses a licensed mailbox and Google sending quotas | Suitable for human correspondence; adds OAuth/quotas and mailbox coupling to order notifications |

Pricing checked against [Postmark](https://postmarkapp.com/pricing) and [Resend](https://resend.com/pricing); reconfirm taxes, currency and plan terms before signup. For Gmail, confirm the account's actual [sending limits](https://support.google.com/a/answer/166852) before selecting it. No provider is activated and no test email was sent.

Later implementation should use an outbox keyed by order/event/template version, verified-payment confirmation, readiness notification only after all lines are ready, provider idempotency/deduplication, bounded retries, bounce/suppression handling and an owner-visible failure state. A sent email never changes payment/stock state. Avoid attaching customer secrets or long-lived QR authority; templates and retention need approval.

## Decisions needed

Approve the primary address/aliases, one seat or a separate José seat, flexible versus annual billing, recovery administrators, privacy/retention settings and preferred transactional provider. Resolve existing tenant/property ownership and complete DNS/mail inventory before requesting approval of an exact activation/cutover package. This document authorizes none of those actions.
