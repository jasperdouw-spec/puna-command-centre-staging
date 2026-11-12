# Approved Phase C architecture and operating policy

This addendum incorporates the owner's Phase C approval and supersedes the proposed ten-minute hold in the earlier checkpoint. Phase B commit `09db737324ae35d64ffe8857c607aef955e0e6aa` and its branch remain preserved. Only local Phase C implementation is authorized; customer checkout/payment replacement, QR flow, email, hosted changes and Google activation remain gated.

## What the local model does

One ready/baking physical ledger contains actual product lots. Each lot records the original batch size and start/estimated-ready timestamps, with four physical buckets: online-ready, online-baking, truck-ready and truck-baking. Channel allocations are divisions of those counted units, not extra inventory. Reservations refer to their actual lot, channel, quantity and ready portion. Free capacity is physical minus active commitments at that same lot/channel/state. A shortage is explicit and free availability is clamped to zero; a paid commitment is never deleted to make the numbers look better.

Start Baking accepts only a fresh catalogue product, a counted oven load and a 20/25/30-minute estimate. It does not offer planned/frozen future batches. Staff confirm readiness, including partial quantities; the server moves units from baking to ready without increasing physical total. Marking another batch of the same product ready does not satisfy an order allocated to the first batch. New ready-count entry and corrections require owner/manager authority, a reason and audit. Existing frozen/factory inventory, legacy orders and their original fulfilment path remain unchanged.

The prototype's ready/baking counts must exclude units already counted in another lot or set aside for legacy orders. There is no automatic conversion of the existing frozen ledger, and historical reporting never seeds physical stock. Before any operational release, validate the boundary between frozen stock, real oven loading and legacy commitments against an actual stocktake. Workers maintain the one new kitchen ledger; its two channel figures are adjusted by a single transfer, not two independent stock systems. Existing detailed inventory tools remain available separately for their existing purposes.

## Allocation, readiness and payment rules

All-or-nothing baskets lock/validate every requested lot inside one transaction. A transfer can move only free units in the chosen stage; it cannot move unpaid holds, payment-pending/uncertain reservations or paid units. Ready confirmation stays within each reservation's actual lot/channel. Within a lot, paid obligations precede payment checks and ordinary unpaid holds; within each class, earlier pickup commitments then creation time/ID order the allocation. This ordering cannot substitute a different batch or change a pickup commitment.

Ordinary unpaid holds default to **300 seconds (five minutes)**, configurable by the owner from 60–900 seconds in the local model. Server database time controls expiry. Heartbeats and mutations sweep definitely unpaid expiries; reservation attempts sweep before validating capacity. Pending, uncertain, paid and counter-payment checks never expire automatically. The current customer checkout's separate existing configuration is not changed by this policy.

Synthetic payment transitions model protected uncertainty and late success. Success after a released hold creates a late-payment exception without reallocating another customer's units; new online allocations pause pending resolution. Authoritative payment reconciliation must remain possible while the truck is stale. No real payment/provider is called. Real exception/refund/customer-resolution workflows are Phase D work.

Paid ready portions are physically set aside and explicitly confirmed by staff. The queue shows actual batch IDs, pickup commitments, ready and set-aside quantities. Real online collection is not implemented in Phase C. The synthetic collection kernel tests that physical stock and commitment retire together, leaving free availability unchanged. Existing legacy collection stays untouched.

Waste reduces the selected physical pool even when this exposes a shortage; the commitment remains and online acceptance pauses. Delay updates keep the original pickup commitments and pause acceptance when the new estimate misses one. Counts/estimates can be corrected with audited reasons, but reopening remains explicit. No automatic replacement, refund, promise change or silent stock release occurs.

## Minimum walk-in workflow to validate at the truck

1. Choose the actual ready batch and quantity, press **Set aside for walk-in**, and physically put those items aside. This reserves truck capacity before payment.
2. Take the payment using the existing Square counter process. No new Square integration or scope is used.
3. Once payment and physical handover are confirmed, press **Paid in Square & handed over**. This consumes ready stock and clears the reservation once. If nothing was paid or handed over, use the explicit confirmed-unpaid cancellation. If payment is unclear, keep the reservation and check Square; a timer will not release it.

The extra acknowledgement is deliberately demonstrated, not assumed. Validate button placement, device access, labels, staff responsibility and busy-service timing in a real truck walkthrough before enabling online sales. If staff cannot reliably perform these steps, keep online sales disabled or use a physically protected fixed online pool until a separately approved POS integration can supply stable event identity and deduplication. Later Square reporting imports only report revenue and must never deduct kitchen units again.

## Freshness and reconnection policy (provisional operating intervals)

- A worker explicitly reviews current counts/paid items/exceptions and connects a designated truck screen. Connecting leaves the kitchen paused; opening is a separate action.
- The server records a stock review and a heartbeat lease tied to the authenticated actor and browser client. That visible screen sends a heartbeat every 30 seconds, with an authoritative read every 15 seconds. Hidden screens stop polling/heartbeats.
- A heartbeat expires at **90 seconds**. A physical-stock review expires at **15 minutes**, even if the tablet remains connected. Heartbeats cannot extend the stock-review deadline. These conservative local defaults require actual truck validation.
- Every new reservation and physical operation checks server time and freshness. Stale state pauses acceptance even if the API responds normally; paid and uncertain allocations stay protected. Pause/Close remain possible as conservative controls. An unexpired paid/pending reconciliation is not blocked merely because the kitchen is stale.
- Reconnect/Open requires an actor/client-specific authoritative observation no more than 30 seconds old and the current stock version. Any intervening stock mutation invalidates that observation. Reconnection cannot reopen automatically or clear shortages/late-payment conflicts. A takeover invalidates the previous screen's heartbeat lease.
- Offline clients disable stock actions. Nothing is queued for replay. After an uncertain HTTP response, staff review the current batches and pickup queue because the action may already have committed. Server operation keys make an identical retry idempotent and reject changed payloads.

Open means online allocation is eligible subject to freshness and exceptions. Pause stops new online reservations while connected staff may prepare food and serve ready truck stock. Closed also blocks new walk-in reservations; existing commitments remain. All physical actions require freshness. UI counts describe free capacity, not a promise that ordering is enabled.

## Public preview and boundaries

The optional read-only homepage panel shows only public catalogue items, free online-ready/baking quantities, the truck confirmation time and an estimate from already-baking batches. It exposes no allocation/customer/staff identifiers. A validity deadline covers both heartbeat and stock review; the browser stops relying on cached quantities when it expires or fetching fails. Stale/closed availability is labelled unconfirmed rather than presented as a real zero-sales/zero-stock claim. No new customer offer, reservation endpoint, checkout or payment path is wired into the public UI.

All feature flags default to false. Synthetic reservation/payment/collection actions additionally require the explicit disposable-local flags and loopback synthetic database identity. They are authenticated staff test controls, not a production checkout. Phase D needs separately reviewed customer authorization, provider state, webhook verification, idempotency, QR inspect/handover, notifications and end-to-end sandbox acceptance.

## Next decisions, not implementation authorization

Validate the minimum counter steps, physical online/paid set-aside labels, review/heartbeat intervals, who owns the designated screen, shift handover, stale/offline contingency, counted-stock provenance and wastage/refund authority with staff. Confirm five-minute customer hold UX and pickup commitments in Phase D. Enabling online sales still requires operational acceptance, verified hosting/deployment configuration, security remediation and a separate approved release.
