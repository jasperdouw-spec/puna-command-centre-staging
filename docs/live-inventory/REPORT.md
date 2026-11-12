# PUNA live inventory and pickup ordering — delivery report

The inventory and ordering candidate is built and deployed to https://staging.punaempanadas.ca. The empty kitchen schema is installed and verified. Hostinger marks `puna-inventory-20cc815-20261112.zip` Completed / Current (November 12, 2026, 09:17:47 Pacific deployment). The approved design is preserved. Customer checkout, live payments and automatic Square POS remain disabled; the kitchen starts closed with no invented stock.

## Built

The existing Command Centre now has a tablet-oriented Ready in Display board and interactive In Oven board. Both use actual product records and existing PUNA photography. Staff can adjust counts with large buttons, start multiple batches, change estimates, confirm partial readiness and cancel remaining baking food. Timers never create sellable stock. Roles, same-origin protection, audit history and protected reservations remain enforced.

The customer cabinet reuses PUNA's charcoal, cream, amber, typography and photography. It sits below the existing menu, preserving the approved hero overlap, navigation and Story. It shows available quantities, prices, low-stock/sold-out/unknown states and separate oven estimates. The stock-aware quantity selector and cart action remain behind the checkout gate.

One MariaDB ledger is authoritative. Version checks, transaction locks, idempotency and five-minute checkout holds prevent double spending. Definite payment failure releases food; uncertain payment remains protected until reconciliation. Disconnect blocks tablet writes; no offline queue is replayed. Reconnection requires refreshed stock and review. Public availability pauses on stale or failed updates.

## What is tested versus operational

| Capability | Status |
|---|---|
| Kitchen display, batches, timers, corrections, audit | Implemented and tested in disposable application |
| Customer cabinet and ready-only availability | Implemented and browser-tested |
| Holds, payment outcomes, packing, QR/manual collection | Tested through local synthetic adapters; not live payment acceptance |
| Square POS webhook adapter | Implemented and synthetic tests executed; disabled on hosting |
| Existing Square reporting connection | Reused read-only; not treated as ready-food inventory |
| Staging database migration | Installed, empty, closed and verified |
| New hosted application | Deployed; public cabinet, closed API, disabled checkout and sign-in protection verified |
| Hosted staff workflow | Installed; existing staff credentials required for authenticated acceptance |
| Physical Lenovo installation/acceptance | Not performed; handoff guide saved |
| Official website / live payments | Unchanged and disabled for this feature |

**Passed:** 181 integration checks against the production standalone build; 55 domain checks in CI plus eight local validation-boundary checks (63 total); type checking and production compilation. Native synthetic restore verified 63 tables, 192 indexes and 71 foreign keys. Final successful CI: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43256538548 (remote commit b4455e064f00cae997ad3ea755a1b952aa3f99e4; matching local source commit 20cc815770a15e45a4be8f8acf2ee5304af86e7e). Square and payment tests used synthetic adapters, not live provider acceptance.

## Previews

The retained kitchen and customer screenshots use clearly synthetic products and counts. They demonstrate the implemented interface, not actual PUNA stock. See the accompanying `screenshots` directory in the evidence backup. The full-resolution desktop/mobile baseline and comparison images are also retained. The actual hosted website was separately inspected at desktop and 390 px mobile widths; it correctly shows the kitchen closed, with all five existing products unavailable for ordering. No browser warnings/errors were observed during the hosted desktop check.

## Remaining work

Complete authenticated hosted staff acceptance using an existing staff/owner account, then physically count opening stock and validate the Lenovo itself. The browser session had no active staff login; `/food-truck` correctly redirected to sign-in. For real Square integration, obtain Catalog read access, verify variation/location mappings, complete Sandbox payment/refund acceptance and missed-event/exception handling. Keep automatic POS and customer checkout off until those pass. A fresh restore of the current private database backup also remains a production gate. No subscriptions, live charges or customer messages were created.

## Documentation and backup

Architecture, data model, API rules, security, synchronization, migration and limitations: `IMPLEMENTATION.md`. Deployment and non-destructive recovery: `DEPLOYMENT.md`. Exact executed evidence: `VALIDATION.md`. Tablet operation and device-agent separation: `TABLET_HANDOFF.md`.

Local source and documentation: `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory`. The original checkout is preserved. The feature branch is backed up in `jasperdouw-spec/puna-command-centre-staging` with full source-tree verification. Google Drive evidence is linked from the established PUNA project reference and tablet folder; see BACKUP_RECEIPT.md for exact verified locations and hashes.
