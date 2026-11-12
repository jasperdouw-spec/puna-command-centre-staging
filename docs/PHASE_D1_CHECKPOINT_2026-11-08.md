# Phase D1 local implementation checkpoint

The authorized local customer journey is implemented and tested with synthetic data, fake payments and local email capture. Branch `codex/puna-phase-d-20261108`, worktree `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-phase-d`, exact parent Phase C `8bd5f2b54ef7797be52e9c3dccfbe971f38dfb34`. Final commit and clean-tree evidence are recorded in the external execution receipt/Drive checkpoint, avoiding a self-referential commit hash in source.

Phase B `09db737324ae35d64ffe8857c607aef955e0e6aa`, Phase C, original/review checkout `b20f516f9a79b6a98a5c2ffd9e262d1501aa975a`, main and existing backups are preserved. No push, merge, deployment, hosted restart, reporting run, existing-database migration, provider activation, external email, DNS change or purchase occurred.

## Implemented

Existing checkout/order foundations now reserve whole ready-only, actual-baking-only and mixed baskets against the Phase C physical ledger. Authoritative prices/taxes, sealed offers, five-minute DB holds, stable retries, no renewal, a 12-item/6-offer limit, session/email/global limits and one active unpaid/uncertain order per session/email bound stock abuse. Adding to a bag reserves nothing. The required Ham & Cheese + Ají Chicken fixture reads configured CAD 8 prices; zero fixture tax is not an assertion of real tax treatment.

Durable payment attempts, provider identities/events and reconciliation leases protect uncertain stock across retries/restarts. Only independently verified fake provider state can declare payment paid; customer/worker state assertions fail. Provider waits occur outside commerce locks. Amount/currency/merchant/location/reference mismatches and duplicate identities fail closed. Paid state is monotonic. Late capture restores only the whole original basket under its original pickup commitment or produces an owner/manager exception, without taking another order's stock or issuing a real refund.

Customer status uses a separate opaque private link, survives refresh and switching links, and can resume an unpaid held payment using its original attempt. Pickup tokens are high entropy, hashed for lookup and encrypted for delivery; they expire and can be revoked/reissued by a manager. Status omits internal IDs, staff/contact details and audit/provider information. No analytics was enabled.

Workers see paid/uncertain/exception orders, physically check/set aside items, then explicitly pack all lines. Payment alone is not Ready. A mixed order waits for its exact batch and one complete pickup. Delays/waste preserve commitments and suppress obsolete Ready jobs. Authenticated camera scanning is opt-in and route-scoped, inspection is read-only, and explicit handover revalidates current paid/ready/fresh state before retiring physical custody and commitment exactly once. Manual exact order/email lookup and handover are audited. Failed offline writes are never automatically replayed.

The durable outbox stores attempts, eligibility, retry/lease state, provider abstraction and timestamps. Local capture is encrypted/idempotent and includes a status link and QR preview. Delivery failure cannot undo payment or stock. Expired job leases are reclaimed after restart. D1 dispatch uses local actions and a guarded fixture pump; it is not an installed hosted scheduling service. Public pickup windows remain inactive configuration pending operating decisions.

Seven new tables and small existing-table extensions are an unnumbered, disposable-only proposal. Intake containment preserves status, reconciliation, queue, notification jobs, packing and safe handover. Full service shutdown is not routine containment for outstanding obligations. [Architecture](PHASE_D1_IMPLEMENTATION_DESIGN_2026-11-08.md), [schema and containment](PHASE_D1_SCHEMA_AND_CONTAINMENT_2026-11-08.md).

## Validation and corrections

Exact commands, from the D1 worktree using the verified local Node 22.23.4:

```sh
export PATH="$PWD/work/runtime/node-v22.23.4-darwin-arm64/bin:$PATH"
npm ci --no-audit --no-fund
npm run build
npm run typecheck
PUNA_LOCAL_DOMAIN_TESTS=true node tests/domain.mjs
PUNA_LOCAL_DOMAIN_TESTS=true node tests/sales-domain.mjs
node tests/sales-dashboard-domain.mjs
node tests/kitchen-domain.mjs
node tests/run-local-disposable.mjs
git diff --check
```

Production webpack build, typecheck and whitespace checks pass. Domain checks: 12 commerce/costing, 9 sales, 11 sales dashboard/calendar, 9 kitchen = **41**. The final disposable integration run passes **171** checks: all 132 inherited checks including expanded recovery, 30 D1 API/security/concurrency checks, 8 D1 browser checks and 1 D1 feature-off check. Synthetic recovery compares **59 tables, 183 index entries and 68 foreign-key entries**, including definitions and row counts. The runner removes only its owned tmpfs database.

Coverage includes all A–I scenarios, duplicate/changed checkout retries, last-unit races, no second availability deduction, pending/uncertain expiry protection, stale reconciliation after restart, same-order payment resume, event replay/forgery/order identity, QR races/revocation/expiry/roles/manual recovery, CSRF/tampering/rate/hold abuse, notification failure/retry/expired-lease recovery/obsolescence, non-loopback fixture rejection, bounded webhook bodies, legacy ledger fingerprints, intake stop and full feature-off behavior. Browser captures use local Chrome, reduced motion and disabled GPU. Customer widths 1440, 768, 390 and 320 pixels and inherited worker/public layouts pass overflow checks. Camera tests stub canvas/media playback/decoding; hardware remains untested.

Exploratory runs failed and were corrected before final acceptance:

- The external Host test exposed a proxy that replaced the supplied authority and a request gate relying only on Next's normalized URL. The proxy now preserves Host; the service also checks original/forwarded authorities.
- A browser assertion incorrectly searched the paid queue for an unpaid hold; it now reads the hold's displayed order number.
- The camera stub supplied no playable frames; the explicit media-playback stub now tests the route/interaction independently of hardware. It does not claim real camera acceptance.
- Changing only the private URL fragment retained the prior order in the UI. The page now handles link changes and ignores stale responses from the previous token.
- Review also corrected worker-label contrast and added a safe unpaid-hold payment-resume control with a browser regression.

No unresolved failure remains in the final local checks. Failed-run logs/captures are excluded from accepted backup evidence. Not run: D1 GitHub/Linux deployment package acceptance, hosted visual/worker acceptance, hosted schema rehearsal, private/current hosted backup restoration, real Square/payment/refund/webhook delivery, external email/deliverability, physical camera devices, José/truck operating walkthrough. Passing tests is not security clearance. Package/lockfile unchanged; the separate dependency proposal remains open.

## Hosted findings, operations and next boundary

Hostinger MCP authenticates. Current completed build is `01a1a5df-b752-723f-92df-d1b0c939f330`, manual archive `puna-reporting-d1ba527-20261104.zip`, Node major 22. Site Git auto-deploy is null and linked repositories are empty; broader automation is unverified. Checkout remains disabled and HTTP responses remain noindex/nofollow. The separate browser receives a Hostinger 403 challenge. Reporting cron is present, but visible pending/refunds output lacks a completion timestamp/watermark; latest success/coverage/errors, SQL schema/ledger/engine/collation and current backups remain inaccessible. [Full read-only findings](PHASE_D1_HOSTINGER_READONLY_2026-11-08.md).

José/worker validation must cover tablet ownership/placement, paid-item separation, alerts, counter steps, batch/waste corrections, heartbeat/review timing, shift handover, opening hours/pickup windows/food holding policy, late pickup/refund authority and frozen/legacy boundaries. No operating hours or real tax policy was invented. [Separate D2 packages](PHASE_D2_APPROVAL_PACKAGE_2026-11-08.md) specify Square Sandbox credentials/scopes/test actions/tunnel/cleanup, email provider options/costs/test restrictions, and real phone/tablet camera tests. Google Workspace, Business Profile, Search Console, GA4/GTM and privacy publication remain preparation-only.

## Documentation and backup receipt

README, DEVELOPMENT, REPORTING, dependency addendum, D1 architecture/hosted/schema/demo/checkpoint and D2 package are updated. The same PUNA Drive reference receives a revision-guarded manual appendix outside DOCSYNC, followed by readback/preservation verification. The new backup belongs under `/Volumes/PacificData/Projects/puna-foods/documentation/backups/puna-phase-d1-<commit12>` and contains the source bundle, documentation, sanitized passing evidence, actual screenshots, Drive receipt and SHA-256 manifest. The external execution receipt records actual final revision, paths, hashes and verification results. Existing B (27 entries) and C (37 entries) backup manifests and bundles were verified unchanged. These are source/documentation/evidence backups, not a new hosted database backup; synthetic recovery is not a private database restore.

D1 ends at this checkpoint. No D2 activation or hosted work is authorized by its completion.
