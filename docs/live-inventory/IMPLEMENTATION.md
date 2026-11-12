# Live inventory and pickup implementation — November 11, 2026 Pacific

This candidate extends the November 9 release source (`960f655` documentation child of deployed `85bed7c`). The original checkout is unchanged. Working branch: `codex/live-inventory-20261111` in `work/live-inventory` under the established staging repository. Current authorization supersedes older phase approval language for reversible development and isolated staging; production launch and live payments remain off.

## Design baseline and additions

The public staging homepage was inspected in Chrome before development at the existing desktop viewport and a 390 × 844 mobile viewport. Screenshots are in the session evidence. Arial/Helvetica sans serif; charcoal background, cream panels, amber buttons; existing logo, mountain empanada hero, baking tray, trailer, surf and apple photographs. Existing responsive breakpoints are 1100 px and 700 px; mobile navigation compacts and the bag remains sticky. Existing public CSS, approved photos, logo, navigation, Story and unrelated page structures are unchanged.

The optional cabinet extends the existing `Availability` component and uses those tokens/photos. Shared kitchen photos are labelled as kitchen photos, not claimed as separate product portraits. Product IDs, names and prices come from the existing products/commerce publication records. Cards show known/unknown stock, ready quantity, sold-out and low-stock status, multiple oven estimates, accessible quantity controls and a gated add-to-order action. The existing cart storage is reused. Stock expires locally after 15 seconds without a fresh response and on offline/error events; the server independently checks heartbeat/review and stock at checkout.

The existing owner Kitchen and staff `/food-truck` interface now include Ready in Display and In Oven, with 64 × 60 minimum stepper targets. Single-tap display adjustments, per-batch oven adjustments, arbitrary 1–240 minute estimates, multiple batches, partial ready transfers and cancellation are audited. Advanced channel allocation, manager corrections, protected pickups and recent adjustment history remain in the same interface.

## Source of truth and transactions

One authoritative ledger: existing `kitchen_state`, `kitchen_lots`, `kitchen_allocations`, `kitchen_allocation_lines`, `kitchen_events`, with existing pickup order records. No Android database and no competing inventory service. Existing separate online/truck allocations are preserved. Staff sees physical display total plus reserved/available counts; customers see the unreserved online allocation. New simple-board counted stock is allocated online by default; managers can allocate stock to the truck through existing advanced controls.

All stock mutations use the existing MariaDB transaction/advisory lock and state-row lock, server clock, version check and operation-key/request-hash idempotency. A correction below existing commitments preserves the commitments and pauses intake. Minus buttons only remove unreserved stock. A timer never moves stock. The reservation kernel and signed checkout offer validator now refuse oven stock; legacy baking commitments can still be completed safely, but no new ones can be created.

Cart additions do not reserve food. Local checkout reserves the entire ready basket atomically, with expiry and idempotency. Confirmed failure releases stock; pending/uncertain payments remain protected until reconciliation. Existing staged payment, pickup token, role/CSRF and handover flows are retained. The local simulation requires exact loopback/disposable database and secret gates. It cannot be enabled on hosting merely by toggling checkout. Real payments are not implemented by the new cabinet and remain a release gate.

Polling: kitchen and cabinet every 5 seconds; one in-flight mutation; 30-second staff heartbeat, 90-second heartbeat expiry, 15-minute physical review. Disconnect blocks edits, no offline queue or automatic retry. Reconnect fetches authoritative state and requires review. The device control agent is separate and holds no order or inventory authority.

## API additions

`POST /api/kitchen` retains staff/manager/owner authentication, same-origin enforcement, strict schemas and 16 KB body limit. Every mutation includes `key` (UUID), `clientId` (UUID) and current `version`.

| action | fields | rule |
|---|---|---|
| display-step | productId, delta ±1 | Existing fresh product, protected stock cannot be removed |
| oven-step | lotId, delta ±1 | Only baking units change; max 500 per lot/stage |
| estimate | lotId, minutes 1–240 | Server now plus minutes; no automatic readiness |
| cancel-batch | lotId, reason | Cancels remaining uncommitted baking units only |
| ready | lotId, quantity | Existing partial transfer; protects actual lot/channel commitments |

The staff snapshot includes the last 40 adjustment events; public availability exposes published product/price/quantity/batch estimates only, no customer, staff or provider identities. Existing manager corrections and order endpoints remain.

## Square integration — implemented adapter, activation blocked

Existing production read-only reporting OAuth is reused for canonical Orders reads. A new separately gated `/api/square/pos-webhook` verifies exact notification URL HMAC, merchant, location, cutover date, event ID and fetched order version. Completed orders use explicitly verified variation-to-product unit mappings. Website Square orders already present in pickup_orders are excluded. Retries/older versions do not deduct twice; revisions deduct only the additional gross quantities. Monetary refunds never put food back on sale. Unmapped lines, shortages and reduced quantities create unresolved issues and pause the kitchen. All mapped lines are applied atomically. Manual counter reservation/deduction is blocked when automatic POS mode is enabled to prevent double accounting.

The connected desktop Square catalog request returned INSUFFICIENT_SCOPES for ITEMS_READ. No catalog IDs were invented, no real sales were imported into stock, no webhook subscription or payment was created. New POS tables are an additive proposal in `db/proposals/live_inventory_square.sql`. Mappings are empty and require actual catalog/location verification and controlled cutover. Automatic POS mode is NOT launch-ready: bounded missed-event catch-up, operational online/truck segregation, owner issue-resolution/replay UI and provider acceptance remain required. Keep `PUNA_SQUARE_POS_ENABLED` unset/false until completed. Manual counted reconciliation remains the current supported operational workflow.

Relevant primary references: https://developer.squareup.com/docs/inventory-api/webhooks and https://developer.squareup.com/reference/square/orders-api/webhooks/order.updated. Native Square aggregate counts are not treated as proof of physically ready display food.

## Migration and rollback

Never apply a seed, reset or migration at startup/build. Existing kitchen/ordering proposals are retained; the hosted November 9 record reported 45 tables, with these proposals unapplied. Current hosted schema must be inspected again before deployment. Apply only to a newly created disposable database for testing. Hosted activation requires a current native encrypted backup, verified isolated restore, schema/ledger preflight and reviewed additive migration. Keep ordering, POS and fixtures disabled.

Rollback is application/feature-off: disable intake, reconcile existing holds and paid obligations, disable the cabinet/kitchen only after continuity is secured, restore the verified prior application archive. Retain ledger and audit tables. Never drop tables or restore an older database over newer business orders as an application rollback. No destructive down migration is supplied.

## Time handling

The inherited tests exposed outdated runtime ICU data for Vancouver after November 2026. Scheduling now uses UTC−7 after March 9, 2026 while retaining historic Vancouver DST rules and rejecting ambiguous/nonexistent historical times. New active kitchen timers display current Pacific time. Province source: https://www2.gov.bc.ca/gov/content/governments/celebrating-british-columbia/daylight-saving-time .

## Device handoff

Entry point remains footer Team sign-in → existing staff `/food-truck` or owner Workspace → Kitchen. HTTPS, same-origin session cookies and server roles control access. PUNA Control Agent/WireGuard provide device administration/connectivity only. No Android system settings, VPN routes, credentials, kiosk policy or other applications were changed. Physical Lenovo acceptance requires tap-size/layout, connectivity interruption, reload, sleep/resume and pickup handover on that device.

## Validation and release gates

See VALIDATION.md for executed evidence. Implemented source, synthetic tests, provider-verified integration and deployment are distinct. Checkout is disabled in hosted staging and production. Do not launch until native schema/backup, real catalog mappings and stock counts, Square Sandbox transactional acceptance, missed-event recovery, physical tablet, permissions, HTTPS and hosted visual comparison pass.
