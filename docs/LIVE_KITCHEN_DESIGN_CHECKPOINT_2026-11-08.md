# Live Kitchen stock and allocation — approval checkpoint

**Phase C approval update:** the owner approved local Phase C implementation with a configurable **five-minute** ordinary hold, explicit walk-in workflow and server-enforced kitchen freshness. The ten-minute proposal below is historical and superseded. See [the approved Phase C addendum](LIVE_KITCHEN_APPROVED_PHASE_C_2026-11-08.md). Phase D and all hosted changes remain gated. The original Phase B document is preserved at commit `09db737`.

Status: proposed Phase C/D design only. Phase B changes no checkout, inventory, payment, collection, camera policy or database migration. The reporting ledger is delayed historical evidence and must never determine available stock.

## Recommended model

Extend the existing frozen/future-batch model with an explicit fulfilment kind and versioned allocation records. Keep legacy orders on their original allocation/collection path; never convert or recalculate them implicitly. New ready-stock orders allocate only counted ready units. Already-baking orders allocate a named batch with a recorded expected-ready time and saleable quantity. Planned/frozen production remains a separate offer; it cannot masquerade as ready or already baking.

Maintain physical ready units, expected baking units, temporary holds and paid commitments separately. For each product/batch and channel: `available = eligible physical or baking quantity - active holds - paid commitments - quarantine`. Availability cannot be negative. Ready and baking quantities must never count the same unit: a readiness event transfers units between states under one transaction.

Use explicit online and walk-in allocations. Both draw from one counted physical stock ledger, but only their own assigned capacity. Increasing one channel's budget reduces the other in the same locked transaction. Walk-in staff reserve/consume from their pool before confirming a POS sale; unsynchronised POS sales alone cannot protect online stock. If this process is impractical, keep a conservative fixed online allocation and suspend online sales when counting falls behind. A later Square reporting import records revenue only; it never deducts stock a second time.

## Reservation and payment lifecycle

1. Server validates current prices, product/batch eligibility, quantities and pickup promise; locks all affected capacity rows in a stable order. Reserve the entire basket atomically or reserve nothing. Store an order-scoped idempotency key and immutable allocation snapshot.
2. Unpaid holds expire after a proposed 10 minutes, using the database clock. The final duration is an owner decision. Never trust the browser countdown. Mark expiry and release only holds whose payment status is definitively unpaid/failed and whose attempt cannot still complete.
3. Beginning payment changes the allocation to payment-pending. A timeout becomes payment-uncertain, retaining capacity while the server checks the provider. Do not silently release capacity, retry with a new payment identity or tell the customer to pay again.
4. Verified success converts holds to paid commitments exactly once. Webhook/event IDs and payment IDs are unique, signatures are checked and duplicate/out-of-order events are harmless. A success arriving after a verified release is an exception: do not take someone else's units. Attempt a new atomic allocation only if all requested capacity remains; otherwise hold the order for owner resolution and a separately authorized refund or revised pickup promise. Display the uncertainty clearly.
5. Definitive failure/cancellation releases the hold once. Refunds do not automatically restore edible stock. Record a separately checked stock disposition.
6. Handover consumes physical units and clears the corresponding paid commitments in one transaction. For example physical 10, committed 2, available 8 becomes physical 8, committed 0, available 8. It does not reduce availability to 6. Repeated collection requests return the original result.

## Batch operations and failures

Record who started baking, actual start time, expected-ready time, expected yield and version. Staff may mark only part of a batch ready; ready quantity cannot exceed remaining batch yield without an audited correction. Allocate ready portions to paid orders according to a documented queue (proposed paid time then order ID). A basket is ready only when every line is ready; split handover is a separate explicit decision, never implied by a partial batch.

Delays change the promised time with an audit record and customer-notification proposal. Wastage first reduces uncommitted capacity. If it affects commitments, mark affected orders as exceptions, stop further sales from that capacity and require substitution/refund/new-time decisions; never silently delete paid allocations. Adjustments require a reason, actor, previous version and counted quantity.

The server is authoritative. Stale/offline clients cannot reserve stock, confirm payment or record handover. Show last confirmed update and disable these actions until a fresh read succeeds. On reconnection reload and resolve version conflicts before writing. A printed/manual emergency process must be owner approved and reconciled before reopening online capacity. Do not queue offline stock mutations that could oversell.

## Scan to inspect, then explicit handover

Use an opaque, high-entropy, revocable pickup token with only its hash stored; no embedded customer details or sequential order IDs. Keep this separate from receipt/payment authority. Scanning performs an authenticated, role-checked read showing the minimum pickup details, readiness and existing collection status. A GET or camera detection never collects an order. A worker must press Confirm handover; the POST requires origin/CSRF protection, current order version, allocation checks and an idempotency key. Duplicate scans and competing staff actions must converge on one handover.

Camera access should later be enabled only on the authenticated worker scanning route with `Permissions-Policy: camera=(self)`, restrictive framing/CSP, HTTPS and a user-initiated browser prompt. Other routes keep camera blocked. Stop tracks when leaving/closing the scanner. Provide manual token entry and an audited owner-assisted lookup; neither bypasses role or readiness checks. Log handover/reversal reason and actor without storing camera frames or raw tokens. Rate-limit token lookup and invalidate tokens on cancellation/reissue.

## Proposed additive migration, rollout and tests

No SQL is added or executed in Phase B. After approval, design the next migration against the verified hosted schema: stock lots/batches, per-channel capacities, allocation/hold rows, immutable stock events, unique payment-event/attempt links, hashed pickup tokens and a notification outbox. Include foreign keys, decimal/integer unit policy, unique idempotency constraints, nonnegative counters, versions, and indexes for expiry/ready queues. Required migration number must follow the actually installed migration ledger; do not assume 009 is free.

Backfill only approved operational counts from an owner stocktake, never historical sales. Defaults leave new functionality off. Add a per-order model version and retain the existing legacy path. Preflight exact schema/row counts; take and verify a current private backup; rehearse restore and migration on an authorized isolated copy. Rollback disables new order acceptance and drains/reconciles holds/paid orders before reverting code. Do not drop additive tables or discard paid commitments.

Required tests: multi-product all-or-nothing reservations; concurrent online/walk-in last-unit competition; pool transfers; hold expiry at the clock boundary; payment-timeout/late-success/out-of-order webhook races; duplicate payment identity; partial readiness; delay/wastage below commitments; stale versions/offline reconnect; authorization/CSRF; QR inspect with zero writes; one explicit collection under concurrent scans; no second deduction; legacy orders; refund stock disposition; notification outbox retries; migration rerun/restore and feature-off rollback. Provider sandbox and hosted camera/device acceptance remain separate release gates.

## Decisions requested before implementation

Approve or revise the shared physical ledger with separately budgeted online/walk-in capacity; 10-minute unpaid holds with uncertain-payment capacity retained; batch promises and partial-ready queue; no automatic replacement/refund for late-payment exceptions; and scan-to-inspect followed by explicit handover. Confirm staff can reserve walk-in stock before POS completion, the stocktake authority and exception/refund authority. Phase C/D starts only after this design checkpoint is approved.
