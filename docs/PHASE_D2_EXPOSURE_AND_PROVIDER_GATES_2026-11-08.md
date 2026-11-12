# D2 exposure and provider gates

The owner has deferred physical devices and email until staging is complete. No tunnel, device session, external sender or Square Sandbox test is active. Continue with the existing **local** private backend and simulated providers; the hosted private backend's read-only production reporting connection is not a payment test credential.

## Security decision and remediation order

The fresh npm registry lookup still reports **14 advisory records across Next 16.3.4, sharp 0.35.4, source-map-js 1.2.1 and Zod 3.25.76**. There is no implemented remediation branch among current local refs. No package/lock update or automatic audit fix was made. The current Next app is not approved for a public tunnel.

The maintainer lists Next 16.4.1 and sharp 0.35.5 as remedies for the SVG optimizer issue on glibc Linux. Another advisory affects typed-array `use cache` results and recommends upgrading even when a matching cache function is absent. This app has no matching image/cache/Server Action use found by source search, but that does not prove every framework route is safe to expose. [SVG advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).

| Priority | Required work |
| --- | --- |
| Before public D2 callbacks | Prefer the separately reviewed callback-only Node listener; no Next/React/sharp/Zod imports, no proxy to the app, exact route/signature/size/rate controls. Local boundary tests pass, but a real HTTPS termination/tunnel, current runtime security review, private configuration and consumer still need an exposure review before opening. If the full app is exposed instead, first implement and test the framework remediation below. |
| Before staging release | Separate candidate branch: verify exact current patched Next 16.x release (documented minimum 16.4.1), resolved sharp >=0.35.5 and source-map-js >=1.2.2; inspect lock/provenance/advisories; run Linux production packaging, full regressions, auth/CSRF/fixture checks and hosted smoke acceptance. The candidate minimums are not yet a tested replacement build. |
| Major upgrades | Zod 3→4 requires an explicit compatibility decision, exact release/advisory/provenance review and validation/error-contract tests. Its use is absent from the relay and bounded in new D1 request bodies, so it need not be rushed into a callback-only prototype. It is **not automatically deferrable for staging**: resolve its applicability or verify a sufficient mitigation before release. Other discretionary major upgrades can wait. |

No active exploit probe or attack payload was sent to hosting. Existing dependency remediation stays outside the D2 feature branch. Production reporting scope/credential changes are never part of remediation.

## Callback candidate and remaining integration

Only `POST /api/ordering/square/webhook` is served. Root, owner, admin, customer, fixture, optimizer, encoded/queried and unrelated paths return rejection. No forwarding is implemented. The listener validates the exact registered URL/raw-body HMAC using a private key, checks the configured seller and any supplied location, then stores only event ID/type/object ID/body hash/receive time. No raw event, card/contact data, QR/status credentials or signature is logged/persisted. Event files are owner-only, bounded and atomically written; an identical duplicate is accepted, conflicting reuse rejected. It is deliberately not a second payment authority.

The CLI defaults off, needs explicit private configuration outside Git, and only binds loopback. It is never started by Next/npm build/start. Future approval/configuration must specify Sandbox environment and verified identities, exact HTTPS URL, signature key, an owner-only spool outside the repository and a session no longer than four hours. Never place the app or fixture endpoint behind a tunnel to this listener. No public listener was opened in this work.

Before actual use, verify separate Sandbox identity through `https://connect.squareupsandbox.com` and a scoped token; expected capabilities are exactly `PAYMENTS_WRITE`, `PAYMENTS_READ`, `MERCHANT_PROFILE_READ`. The helpers check normalized results but do not perform remote identity retrieval. Integrate the real adapter into durable attempts with stable create/refund keys and unique provider identity. A private consumer must independently retrieve each event's provider object and apply the existing transactional order/stock guards. Timeout with unknown payment ID must recover via the same durable request/key or authoritative lookup, never a new charge. Preserve uncertain commitments. A refund must change financial state once and leave stock disposition to an explicit operational decision. No refund is authorized/run yet. [Square Sandbox](https://developer.squareup.com/docs/devtools/sandbox/overview), [signature validation](https://developer.squareup.com/docs/webhooks/step3validate).

The relay alone does not provide a customer status URL usable on another phone. Real-device and mobile email-link tests need an approved private HTTPS test environment after staging; do not relax disposable-local guards as a shortcut. Native BarcodeDetector remains conditional; the current approved fallback is authenticated manual recovery, not a cross-browser decoder library.

## Email after staging

No provider is selected/activated for sending, no recipient is approved, and no email adapter has been connected. The tested exact-recipient helper denies an empty allowlist and rejects other recipients, wildcard entries, list/display-name syntax and whitespace injection. When sending is integrated, it must be called immediately before every attempt, including retries; allowlisting a domain is insufficient.

Resend is the leading candidate for a small restricted real-inbox test after account/recipient approval; verify the selected account's sender restrictions then. Postmark Sandbox deliberately discards messages even when its UI/webhooks say Delivered, so it cannot satisfy actual inbox acceptance. [Postmark Sandbox behavior](https://postmarkapp.com/developer/user-guide/sandbox-mode/server-sandbox-mode/).

For a later Resend adapter: retain the durable outbox ID as idempotency key; its provider dedupe window is 24 hours, so ambiguous older attempts require reconciliation/manual review before retry, never blind resend. Embed QR with CID attachments and plain-text fallback, not a D1 preview-only data URL. Disable link/open tracking; never rewrite private status links through analytics. These are integration requirements, not completed provider tests. [Idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys), [inline CID images](https://resend.com/changelog/embed-images-using-cid).

Future `orders@punaempanadas.ca` needs an approved transactional sender/domain, provider SPF/DKIM, a reviewed DMARC policy and monitored replies. Preserve existing MX/email records. A separately approved mailbox or alias/Reply-To can handle replies; Google Workspace is not required for API delivery itself. No address, account, alias or DNS record was created. Actual desktop/mobile receipt, link correctness, QR readability and failure/retry/dedupe evidence must be recorded later; API acceptance is not delivery.
