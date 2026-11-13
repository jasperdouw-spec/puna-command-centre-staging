# Unified menu and persistent service sessions — 12 November 2026 (Pacific)

## Scope and source

Extends the deployed kitchen-UX tree `baf780c7f6f2788b40fb189fea8bf542a019ac3a` and its documentation checkpoint `a9859e73aaa0977b75c31f0e328ec4c3635af7bd`. Development branch: `codex/unified-menu-20261112`. Original root checkout remains untouched. No live payment, automatic POS deduction, production launch or physical-stock attestation is authorized by these changes.

## One customer menu

The existing cream menu panel, original product card classes, descriptions, prices, typography and shared baking photograph are reused. All published fresh empanadas use the same original card treatment. A scoped extension adds separate ready and batch-specific baking availability, selectors and a draft bag. The redundant cabinet is removed when the preview flag is active. Hero, Story, navigation, photography and unrelated dashboard charts are unchanged.

Draft bags reserve nothing and can be previewed on staging while checkout is closed. Exact product, lot and stage selections persist in `puna-live-bag-v2`. Checkout rechecks signed offers and rejects missing/reduced selections without substituting another batch. Public availability uses no-store polling, a 15-second client freshness bound and visibility/network recovery. Unknown stock is never represented as counted zero.

## Persistent operational authority

Business mode, physical inventory confidence and device connectivity are independent. A stock review records a configurable deadline (default 8 hours; owner range 1–12 hours). Opening requires a review within five minutes and a closing time within 12 hours. Every authoritative request evaluates closing and confidence deadlines against server time. This continues across browser navigation, tablet sleep and backend restart; a scheduler is not required to reject orders after closing.

Heartbeat still reports device presence at 90 seconds, but does not grant or revoke stock confidence. Browser connectivity loss blocks local edits; reconnect requires an authoritative refresh and never replays taps. Expired staff authentication requires sign-in. Actual shortages, delayed commitments, missing confidence and unaccepted automatic-POS reconciliation block intake independently of business mode. Staff may correct or physically confirm food while confidence is blocked but the physical-review deadline remains valid; reopening availability requires a fresh review after issues are resolved.

Staff must keep website allocations physically separate from counter food, reserve counter food before Square payment, and record paid handover exactly once. Automatic Square deductions remain off. An unattended browser cannot establish that unrecorded in-person sales are reconciled. The operational policy does not remove this release requirement.

## Batch allocations and checkout

The existing `kitchen_lots`, `kitchen_allocations` and allocation lines remain authoritative. The existing commerce transaction serializes reservations and mutations. Signed offers identify a specific lot and ready/baking stage; a hold reserves the exact selected quantities atomically. Maximum basket: 500 units and 20 distinct offers, further limited by owner-configured pickup capacity. Entire baking batches are supported within these limits.

Elapsed oven timers never produce ready food. Partial readiness transfers protected allocations first, then unreserved units. Batch decrements, transfers and cancellation cannot consume reserved units. Explicit physical wastage/correction may record a real shortage, preserving obligations and blocking new orders rather than silently deleting promises.

Unpaid expiry/cancellation releases only after a definite no-payment result. Pending, uncertain and paid allocations remain protected. Public/staff reads also expire eligible holds and identify elapsed commitments without requiring a tablet heartbeat. Failed payment, idempotent retry, provider reconciliation and late-success protections reuse the existing local provider infrastructure. A manager-only simulated refund releases baking allocations and quarantines prepared ready units to counter allocation for physical review; it cannot restock them automatically online. This is not a live Square refund implementation.

## One pickup window

Window start is the next capacity bucket after max(server now, latest required batch ETA) plus the configurable preparation buffer. Default: 10-minute buffer, 15-minute window, at most 6 orders/60 units per window. The complete window must fit before closing. Reservation revalidates the quoted start/end and capacity; competing orders cannot silently change the promise. Ready orders and mixed/multiple-batch orders use the same calculation.

`kitchen_pickup_schedule` preserves the original start and current estimated window. Delayed batches recompute capacity, flag affected orders for manager review and enqueue the existing idempotent local notification outbox. An elapsed ETA requires a physical check or corrected estimate. No feasible window before closing requires manager resolution/refund. Revised windows do not imply customer consent or delivered email. Staff must review the revised commitment; local tests capture messages without sending them. Production notification-provider acceptance remains outstanding.

## Schema and rollback

Additive migration `010_kitchen_service.sql` creates `kitchen_service` and `kitchen_pickup_schedule`, preserving every existing count, batch, reservation, order and audit event. It requires the existing checked 006/009 migration ledger. Reruns verify checksum and required tables. Unexpected existing extension tables fail for inspection.

Existing legacy Open is deliberately not migrated into verified physical stock: metadata starts `unreviewed`. Actual staff must review their counts and open a session. Do not treat previous staging entries as verified food.

Before application deploy: retain the current source archive and host database checkpoint; record stock/state/audit fingerprints; apply 010 once and record its checksum. Rollback uses the retained previous application archive and disabled ordering flags. Keep the additive tables and all ledger history. Do not drop tables or restore an old database over new business activity. The previous application ignores the new tables and retains its older heartbeat safety policy.

## API and security

- `GET /api/kitchen/availability`: published display products, available ready lots, unreserved/reserved batch quantities, estimates, business status, confidence reason, session deadline and service policy. No private order/contact/staff identifiers.
- Authenticated `POST /api/kitchen`: existing inspect/review/mode/stock/batch actions; adds closing time, owner service policy and explicit confidence-loss action. Role, CSRF, version/read checks and audit remain enforced.
- Existing local-only checkout API: stage-specific catalogue, atomic whole-bag quote/reserve, private status and unpaid cancellation.
- Existing local-only pickup API: preparation/packing/handover plus manager delay review and simulated refund. Payment uncertainty never becomes a worker-controlled paid flag.

The D1 checkout/provider remains restricted to loopback, disposable synthetic database and explicit capability gates. Hosted staging cannot enable local simulations through a UI or forwarded host header. Square live payments, official production checkout and automatic POS remain disabled. No new inventory authority is added to PUNA Control Agent.

## Validation status

Final application CI at source tree `d5b93fd5d2f267f05ccf87007814f665641cc4c5` passed 193 disposable integration checks, 76 domain checks and 25 validation/provider-boundary checks, with typecheck and Hostinger-compatible production build. The long-description mobile layout, separate business/availability labels and disabled readiness actions before physical review are covered. See CI-RELEASE.txt and RELEASE-REPORT.md for exact runs, hosted acceptance and physical-device limitations. Earlier CI files are retained checkpoints, not substituted for final acceptance.
