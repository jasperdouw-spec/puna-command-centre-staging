# PUNA kitchen workflow and dashboard — completion report

Completed staging release, verified 13 November 2026 UTC. This report covers the fixes requested after Lenovo testing. It extends the established live-inventory project; it does not activate the official website, checkout, payments or automatic Square deductions.

## Delivered and deployed

Kitchen: https://staging.punaempanadas.ca/food-truck

Sales dashboard: https://staging.punaempanadas.ca/workspace?view=today&tab=sales

Customer website: https://staging.punaempanadas.ca/

Hostinger shows **puna-kitchen-ux-c73940f-20261112.zip — Completed / Current**, with deployment time November 12, 19:56:10 as displayed in its interface. The existing manual upload workflow, Node 22, Next.js standalone output and staging database were reused. No schema migrations, dependency installations, credential changes or production deployment occurred.

| Evidence | Value |
|---|---|
| Implementation branch | codex/kitchen-ux-20261112 |
| Tested/deployed local application commit | c73940fb4a3cf6e049332aaa200e098729892f3e |
| Matching GitHub application commit | d733e98900d1028e703c6c28c4015cd7fb6cd545 |
| Exact source tree on both | baf780c7f6f2788b40fb189fea8bf542a019ac3a |
| Deployed source ZIP SHA-256 | c74972a125bc96f294848068ef2ed4b083cd3ae40095f2f24a33575a0beeddf7 |
| Tracked files in deployed ZIP | 258 |
| Draft PR, unmerged | https://github.com/jasperdouw-spec/puna-command-centre-staging/pull/3 |
| Successful integration CI | https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43354229829 |
| Successful PR production build | https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43354234800 |

Later documentation-only commits do not change the application deployed above. Original checkout `review/puna-isolated-integration` at b20f516 remains untouched. Source and matching local records are in `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory`.

## 1. Confirmed causes

**Empty cabinet:** the availability query required the product ordering flag `available=1`. All five published empanadas had that flag disabled while ordering was closed. The API therefore returned no products independently of connection freshness. Display publication is now separate from ordering permission. The five existing empanadas appear even while checkout stays disabled.

**Connection expiry:** the kitchen heartbeat comes from the visible staff screen. Leaving the page, switching apps or locking the tablet stops it. The observed last heartbeat was 2026-11-13T01:58:39.556Z; its 90-second lease ended at 02:00:09.556Z. The later public response was correctly paused. This was a verified additional cause of unavailable stock, not an assumed explanation for every earlier empty cabinet.

**Confusing saved state:** counts, stored Open mode and the heartbeat persisted in the database. The previous UI highlighted stored Open even when effective service had expired, while transient connection/review fields appeared reset. The new UI distinguishes effective availability from saved service mode and explains exactly what staff must do.

**Oven controls:** the empty-row start action was hidden inside secondary details, and stale connection state disabled controls with insufficient guidance. Hosted audit inspection showed no oven-start events. There was no evidence that a successful backend oven transaction had lost stock. The new visible start/edit/transfer flow was exercised against the actual API in a disposable environment.

## 2. Kitchen fixes and staff workflow

- Clear two-step **Check & connect → Choose service status** flow. Connecting records a real review and pauses intake; it does not reset counts. Select Open after counts and exceptions are correct.
- Effective Open/Paused/Closed status, connection ownership and freshness reasons. Stored Open no longer falsely implies live customer availability.
- Authoritative refresh every five seconds; visible owner heartbeat at least every 25 seconds; eight-second request timeout, single-flight requests, version checks, visibility/pageshow recovery and wall-clock sleep detection.
- A failed request or offline transition blocks further writes and requires an explicit review/reconnect. Taps are not queued or automatically replayed. An uncertain result must be resolved through saved counts/history before repeating it.
- **Preview customer website** opens the real public cabinet component inside the kitchen page, allowing staff to inspect it without leaving the heartbeat screen. Native dialog and Escape/close behavior work without relaxing the site's frame-denial policy.
- Website versus Counter quantities explain which unreserved ready food is published. Only confirmed, free, website-allocated empanadas appear as available.
- Existing authentication, permissions, row locking, optimistic version checks, idempotency and audit history remain authoritative.

The existing limits remain **90 seconds since the last heartbeat and 15 minutes since physical review**. Food does not disappear from the ledger when these expire. Customer availability pauses until staff physically review, reconnect and select Open again. The system intentionally does not keep stale food saleable in the background.

## 3. Oven and operational interface

Each empanada has visible new-batch quantity +/- controls, expected minutes and **Start baking**. Existing batches support +/- quantities, batch selection, ETA edits, countdowns, partial **Move to display** and explicit cancellation. An elapsed timer never makes food saleable. Tests cover multiple batches, remaining quantities after partial transfer, corrections and audit history.

“On the go” is replaced with **Batch tools**: choose one counted batch, then a clearly named task. It preserves setting aside a walk-in order, moving free stock between website/counter, recording waste and manager count corrections. Protected reservations stay protected. Empty/completed batches can be included. Pickup/handover, additional counts, hold policy and legacy tools remain available without duplicating every action in every row. Sauces and drinks have a separate ready-items section; they are not presented as oven empanadas.

## 4. Verified staff-to-customer synchronization

The disposable production-package tests verify display adjustments and batch starts through touch-enabled staff UI, public availability updates, separate informational baking quantities, partial confirmation into ready stock, concurrency, navigation, expiry, offline recovery and session expiry.

Hosted postdeployment read-back at 2026-11-13T03:03:39Z found the same **version 25, five lots, 14 ready, zero baking, zero reservations and 24 audit events**. Allocations remain 13 website / one counter; these include four sauce units. No synthetic stock, opening attestation, transfer or deletion was performed on hosted staging. Physical accuracy of the retained quantities is unknown.

The deployed public API now returns Ají Chicken, Carne, Ham & Cheese, Puna Strüdl and Roasted Eggplant. All have `orderable=false`. Its expired connection correctly reports `status=paused`, `fresh=false`, zero saleable ready stock and no saleable oven stock. The cabinet displays **Availability unconfirmed / Ordering closed**, rather than an unexplained empty list.

Thus the complete fresh/open transactional flow is verified in disposable integration tests; hosted acceptance confirms the fix, retained data and safe expiry. A fresh hosted opening requires a real physical stock review, which was deliberately not fabricated remotely.

## 5. Dashboard and design preservation

The original scorecard markup and donut implementation are unchanged. Card plots are now 94px high, detailed charts 320px high, with responsive geometry, clear axes/units, brand gold/olive/brown colors, exact-value tooltips and keyboard access. Counts use signed bars; sales use a line with fill; average order value uses a line. Null observations remain gaps and future buckets are omitted. No data is invented or smoothed. Reduced-motion preferences are respected.

Hosted Day/Month filters and keyboard tooltip were checked. At 800px tablet width, the detailed plot measured 498×320 and card plots 233×94, with no document overflow. November 1–12 observed values remained $4,589.80 net sales, 223 transactions, $20.58 AOV and 712 signed units, matching the predeployment month view. Existing reporting coverage warnings remain: 47 unresolved mappings, 151 excluded/held provider orders and one unfinished scan at inspection. These figures are observed ledger values, not certified totals or live stock.

The approved homepage source, global CSS, reporting calculation source, scorecard markup and donut source are unchanged. Desktop/mobile hero comparisons were pixel-identical. Story comparisons passed the existing visual thresholds; exact design signatures matched. Hosted 390px mobile inspection had no horizontal overflow and retained the logo, hero photography, typography, navigation and Story. No console errors were captured in the checked hosted kitchen and reporting tabs.

## 6. Test results

| Validation | Result |
|---|---|
| Production-package integration | **186 checks passed**, disposable MariaDB 11.8.9, synthetic data only |
| Domain tests in CI | **62 passed**: domain 12, sales 9, dashboard 11, kitchen 9, inventory 15, chart 6 |
| Additional local validation-boundary checks | **8 passed**; 70 domain/boundary checks total |
| Type checking and production build | Passed locally and in CI; Hostinger deployment completed |
| Touch browser layouts | 800×1280 tablet, 390×844 and 320×740 mobile, plus desktop |
| Safety and transactions | Stale/expired stock, session expiry, concurrent updates/reservations, expiry, failed/cancelled/uncertain payments, idempotency and retry checks passed |
| Square behavior | Synthetic webhook signature, merchant/location, duplicate/version, refund, unknown mapping, shortage and rollback tests passed |
| Synthetic restoration | 63 tables, 192 indexes, 71 foreign keys preserved |
| Approved design regression | Passed; hero identical, Story within thresholds; scorecard/donut/calculation sources unchanged |
| Actual Lenovo hardware acceptance | **Not completed**; ADB listener denied by session sandbox |

These are named application checks, not claims of 186 independent browser sessions. Accessibility validation includes semantic controls, touch target/layout checks, keyboard chart interaction and reduced-motion behavior; it is not a comprehensive external WCAG certification.

## 7. Screenshot evidence

Images are saved in `test-artifacts/kitchen-ux/screenshots/` and included in the evidence backup:

| Before | After | Interpretation |
|---|---|---|
| dashboard-cards-before.png | dashboard-cards-after.png | Exact previous chart component versus new component, same synthetic API values |
| dashboard-chart-before.png | dashboard-chart-after.png | Same synthetic period and missing observations; larger detailed plot |
| kitchen-before-previous-release.png | inventory-kitchen-overview.png and inventory-batch-tools.png | Previous release capture and current disposable acceptance views; not identical stock fixtures |
| cabinet-before-previous-release.png | inventory-display-panel-desktop.png / inventory-display-panel-mobile.png | Previous release and current synthetic cabinet views |
| inventory-baseline-desktop/mobile-hero.png | inventory-preserved-desktop/mobile-hero.png | Approved hero comparison |
| inventory-baseline-desktop/mobile-story.png | inventory-preserved-desktop/mobile-story.png | Approved Story comparison |

The current kitchen overview capture is scrolled; Batch tools is the clearer operational detail image. Synthetic screenshot values are not real PUNA sales or opening inventory. Actual hosted read-only inspections additionally verified the deployed result.

## 8. Physical device and Square limitations

The project's official ADB 36.0.2 and standard ADB could not start their local server socket under this session's restrictions. Actual Lenovo touchscreen, Android background/lock behavior, Wi-Fi interruption and Control Agent acceptance remain unverified. No firewall, WireGuard, Android or Control Agent settings were changed. See TABLET_ACCEPTANCE.md for the exact physical sequence and outstanding gate.

Existing Square reporting still supplies observed data. Automatic POS inventory deductions remain off. This release adds no live Square charges, real payment acceptance or production POS certification. Synthetic tests do not establish real Square acceptance. Existing mapping and coverage issues are preserved and explicitly visible.

## 9. Deployment, rollback and backups

All seven inspected release switches retain their safe values: live kitchen/public preview on; fixtures, local ordering, new-order acceptance and automatic POS off; checkout mode disabled. No official-production traffic was switched.

Rollback source: `test-artifacts/final-release/puna-inventory-20cc815-20261112.zip`, SHA-256 `3be36324f96e552284d5d75824c41833413c84aa02a66fd30a757c5ad47cae9b`, reverified. Redeploy that archive with the existing environment/database if application rollback is needed. Do not replace the database with an earlier snapshot over subsequent ledger events. No reverse migration is needed.

Hostinger's previous native files/database backup was visible, dated November 11, 23:37 in its interface. A fresh manual backup was unavailable because of its 24-hour cooldown. No fresh private hosted-database restoration is claimed. The local evidence archive contains source, documentation, selected screenshots and sanitized test results, **not business data or secrets**.

Documentation is retained in `docs/kitchen-ux/` on Pacific Core and synchronized into the existing website Documentation folder and PUNA Tablet Project. The established Complete Project & Operations Reference receives a dated addendum. See BACKUP_VERIFICATION.md for saved file IDs, hashes and read-back results.

Automatic browser approval review rejected downloading the complete CI screenshot archive because it could not verify the download origin. Selected screenshots had already been retrieved and saved through the authenticated GitHub evidence flow. The rejected download was not bypassed; selected images are the delivered evidence set.
