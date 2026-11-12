# Validation and release evidence — November 12, 2026

## Environment and isolation

The original Pacific Core checkout was preserved. Implementation lives in its nested `work/live-inventory` checkout on `codex/live-inventory-20261111`. Local commits and the authenticated GitHub feature branch use different parent histories but their complete source trees were compared and match at each upload. Nothing was merged into the official deployment branch.

Local type checking and production compilation passed. Because this Work session cannot open the local database/container/listening sockets, full integration ran in GitHub Actions against a newly created MariaDB 11.8.9 database. A clean archive was extracted, installed with locked dependencies under NODE_ENV=production, compiled with Node 22 and the Hostinger-compatible WASM compiler, then tested as the actual standalone production application over local HTTPS. Every provider, customer, credential, payment and email in that run was synthetic. No live Square transaction or customer message was created.

## Coverage

| Area | Executed checks |
|---|---|
| Display and oven | ±1, nonnegative counts, protected stock, quantity limits, multiple batches, server ETA, expired timer, partial transfer, cancellation |
| Concurrency | Competing customers for the last item, counter versus website allocation, competing transfers, idempotency keys, stale versions |
| Checkout simulation | Whole-basket holds, expiry, failure/decline, uncertain payment protection, retry, late success, amount/currency/merchant/location validation, packing and one-time collection |
| Square POS adapter | HMAC, merchant/location, canonical version, duplicate concurrent events, gross quantity deltas, no refund restock, unknown variants, shortage atomicity, audit rollback and feature-off rejection |
| Connectivity | Staff offline edit blocking, no reconnect replay, explicit review, stale heartbeat and physical review, customer paused/unconfirmed state and recovery |
| Browser | Desktop, 800/768 tablet, 390 mobile, 320 narrow, labelled controls, 60+ px kitchen touch targets, no overflow, client exception checks, checkout/QR/manual pickup paths |
| Preservation | Approved asset/CSS hashes, exact section text/computed design properties, desktop/mobile screenshot comparison, existing reporting/order/inventory fingerprints |
| Recovery | Migration rerun, missing-table detection, feature-off retained paid commitments, native synthetic database restore with table/index/FK/count comparison |

The visual test excludes the unrelated fixed mobile bag from cropped section comparisons and trims two crop-edge pixels. Full-page screenshots remain unchanged. A small perceptual threshold accounts for browser text/photo resampling; this is not a claim of byte-identical full pages. Early failures identified and corrected the cabinet's placement above the hero/menu overlap and an unbounded logo size.

**Passed:** 181 integration checks against the production standalone build; 55 domain checks in CI plus eight local validation-boundary checks (63 total); type checking and production compilation. Native synthetic restore verified 63 tables, 192 indexes and 71 foreign keys. Final successful CI: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43256538548 (remote commit b4455e064f00cae997ad3ea755a1b952aa3f99e4; matching local source commit 20cc815770a15e45a4be8f8acf2ee5304af86e7e). Square and payment tests used synthetic adapters, not live provider acceptance.

## Hosted operations actually executed

- Read the current manual Hostinger deployment, runtime/build settings and staging database before edits. Existing deployed source: `85bed7c71c6e5157abb9ba278ac5acc135c7a12d`, archive `puna-prestaging-85bed7c71c6e-20261108.zip`.
- Created a native Hostinger files-and-databases backup; UI confirmed completion at November 11, 2026 23:37 Pacific. A fresh restore of that private backup was not performed; historical November 9 restore evidence is separate.
- Verified MariaDB 11.8.9, 45 pre-existing tables, two exact 006/008 migration checksums, parent key types/collation and InnoDB engines.
- Applied only additive migration 009 to the staging database. Verified six new tables, 45 columns, five CHECK constraints, eight FKs, six PKs, one closed state row, zero new business rows and exact recorded checksum `ada479c9899aaae66e04c7a34b864d1d76f15831a733dfd30a6985d62aa6940f`.
- Did not apply ordering/POS proposals, seed stock, alter existing business tables, change DNS or activate payments.
- Deployed the verified 244-file source archive `puna-inventory-20cc815-20261112.zip`; SHA-256 `3be36324f96e552284d5d75824c41833413c84aa02a66fd30a757c5ad47cae9b`. Hostinger shows Completed / Current, deployment timestamp 2026-11-12 09:17:47 Pacific. Initial browser file-chooser timeouts were resolved through the ordinary native file picker without changing security permissions.
- Preserved all existing environment settings and added the seven non-secret kitchen/gating variables in DEPLOYMENT.md: kitchen and public preview true; fixtures, local ordering, new ordering and Square POS false; checkout disabled. Existing STAGING_TEST_ORDERS_ENABLED remains false.
- Hosted homepage renders the cabinet and existing five catalog products; hero, Story, imagery and navigation remain intact. Desktop console check returned no warnings/errors. Actual 390 px mobile inspection confirmed document width 390 px and no horizontal overflow. Temporary viewport changes were reset.
- Hosted `/api/kitchen/availability` returned enabled=true, preview=true, status=closed, fresh=false, heartbeatAt=null, validUntil=null and products=[]. `/api/checkout` returned mode=disabled and null Square application/location IDs. No stock or food count was entered.
- `/food-truck` redirected to existing `/sign-in`, confirming unauthenticated protection. The browser had no existing staff session; on-host authenticated mutation/role acceptance remains unexecuted. Staff role/CSRF/mutation tests passed on the disposable production build.

## Limits and release gates

Physical Lenovo touch, sleep/resume, Wi-Fi/WireGuard and camera tests remain unexecuted. Automated accessibility checks cover labels, target size, keyboard-operable native controls and layout; they are not a complete WCAG audit. Real Square Catalog access lacks ITEMS_READ; verified variation mappings, provider Sandbox transactions, missed-event catch-up and operator issue resolution are required before automatic POS or live online ordering. Existing reporting remains separate from physical display stock. No live refund or business record was modified.

The application and additive schema are installed in staging. Remaining operational gates are authenticated hosted staff acceptance, physically counted stock and the physical Lenovo. Production launch is a separate decision after the operational, provider and recovery acceptance gates.
