# Kitchen workflow and dashboard improvements — 12 November 2026

This addendum extends `docs/live-inventory`; earlier release checkpoints remain intact.

## Verified starting point

Original checkout: `review/puna-isolated-integration`, b20f516. Implementation checkout: `work/live-inventory`, branch `codex/kitchen-ux-20261112`, based on local 4be3aa5 (same full source tree as remote 6d19094). Previously deployed implementation: 20cc815. No checkout or payment activation is authorized by this release.

Read-only hosted inspection found 14 ready units, zero baking, 13 assigned to the website and one to the counter. Their physical accuracy is unknown; no count, opening action, transfer, reservation or deletion was performed on staging. The audit contained successful display adjustments and no oven starts. Counts, stored Open mode and heartbeat timestamp persisted.

## Causes and changes

1. Public availability filtered by the product ordering flag (`available=1`). All five published empanadas had this flag disabled. This produced an empty product list independently of kitchen freshness. Cabinet publication now uses the established staging publication and empanada category. A separate `orderable` field retains the ordering restriction; checkout eligibility is unchanged.
2. The active staff screen supplied heartbeats only while visible. Navigating away stops them. The observed heartbeat at 01:58:39 UTC expired at 02:00:09; the later customer response correctly reported paused. The 90-second connection and 15-minute physical-review limits remain. Saved stock is independent of connection state.
3. The UI highlighted stored Open even when effective availability was paused, with weak guidance. It now shows effective service state, connection ownership, remaining validity and a two-step review/connect → Open flow. Returning before expiry preserves the session; returning after expiry requires review and reopening. Offline actions are blocked and never replayed. A same-page customer cabinet dialog reuses the public component and keeps the visible kitchen owner mounted. Framing is still denied by the unchanged CSP; no iframe or security-policy relaxation is needed.
4. Empty oven rows hid batch creation, and expired freshness disabled controls without local guidance. New-batch controls are visible; existing batches have quantity, ETA, partial-ready transfer and cancellation actions. Timers remain informational. Sauce/drink counts remain accessible outside the empanada oven board.
5. “On the go” duplicated every batch's complex controls. Batch tools now selects one counted batch and one task, preserving allocation transfers, walk-in reservations, waste and manager corrections. Empty/completed batches remain recoverable. Existing pickup reservations and handover controls remain.
6. Charts now use responsive SVG geometry, 94px card plots, 320px detailed plots, currency axes, keyboard/touch tooltips and straight observed segments. Transactions/items use signed bars; AOV uses a line. Nulls remain gaps, future buckets are omitted, and zero is a real baseline. Scorecard markup, donut, reporting calculations and source values are unchanged. Reduced motion is respected.

## Security and deployment

Existing authenticated API, role checks, optimistic version checks, row locking, idempotency and audit ledger remain authoritative. No schema migration, credential change or new dependency. Keep all checkout, live payment, synthetic hosted fixtures and automatic Square deduction flags disabled. Only staging.punaempanadas.ca may be updated.

Retain the prior verified source ZIP and inspect the native Hostinger backup before deploying. A new manual backup was attempted but unavailable because of Hostinger's 24-hour cooldown; the previous native backup remained available. This release changes application files only. Roll back by redeploying the prior verified source archive with existing environment values; do not restore an old database over subsequent ledger events. This release does not require a database rollback. See DEPLOYMENT.md and REPORT.md for the completed acceptance and backup limitations.

## Validation plan and limitations

Local typecheck and production build pass. Regression coverage adds published-but-disabled products, expiry boundaries, touch batch actions, multi-batch ETA/cancellation, allocation and walk-in flows, navigation/reconnection, authentication expiry and chart geometry/keyboard interactions. The full production-package integration suite runs against disposable MariaDB and synthetic Square fixtures in GitHub Actions because this session cannot open local sockets.

Before/after chart images reconstruct the exact pre-change component from 4be3aa5 against the same disposable API values; they are explicitly synthetic comparisons, not hosted historical screenshots. Approved hero/Story content, design properties and screenshots are compared separately.

Physical Lenovo testing remains unverified: both standard ADB and the project's official ADB 36.0.2 server at port 5038 were denied local listener permission by this execution sandbox. No Android settings, firewall or control-agent security was changed. Browser touch simulation does not establish physical acceptance. Final test/deployment and backup evidence is recorded in the completion addendum.
