# PUNA unified menu and persistent kitchen — release report

12 November 2026 (Pacific); implementation and deployment work continued into 13 November UTC.

## Delivered behavior

The original PUNA menu is now the single customer menu. It retains the cream card design, baking photograph, product names, full filling descriptions, prices and typography. Each card adds ready stock, individual baking batches and estimates, quantity selection, a pickup option and a draft bag. The separate glass cabinet is removed. The hero, navigation, Story and unrelated dashboard remain unchanged. The existing dashboard scorecards and pie chart were not modified by this release.

The actual catalogue remains Roasted Eggplant, Ají Chicken, Carne, Ham & Cheese and Puna Strüdl. No sales or stock data was invented. Unknown stock is shown as unconfirmed, rather than a misleading counted zero. The menu remains visible when intake is paused.

## Implemented and tested transactional features

| Area | Behavior | Acceptance boundary |
|---|---|---|
| Ready-now orders | Atomic reservation of free, physically confirmed units; signed offers and repeat validation | Disposable full application/provider simulator |
| Oven pre-orders | Exact active-batch holds, full-batch reservations within capacity, remaining free/reserved quantities | Disposable full application/provider simulator |
| Mixed orders | One window after the latest required batch ETA plus preparation buffer, with order/unit capacity and closing limits | Disposable full application/provider simulator |
| Concurrency | Shared ledger, serialized transactions, version checks, idempotent operations; competing customers cannot reserve the same units | Automated integration |
| Expiry/payment failure | Definite unpaid expiry/cancellation releases capacity; pending or uncertain payment retains protection | Automated synthetic provider integration |
| Readiness | Staff confirmation only; partial transfers allocate reserved units first; timers never release food for sale | API and touch-browser tests |
| Changes and shortages | Reserved commitments survive corrections; shortages/delays pause new intake and flag staff review | Automated integration |
| Fulfillment | Existing preparation, paid-item set-aside, packing and collection workflow extended with commitment review | Local synthetic checkout/pickup workflow |
| Notifications/refunds | Idempotent local notification outbox/capture and manager simulated refund; no real messages or refunds | Production provider acceptance remains outstanding |

Staging customers cannot pay or place real reservations. The bag is a preview and reserves nothing. The complete transactional engine is implemented and tested in a disposable environment; its payment/notification adapters remain deliberately gated for hosted use.

## Persistent business sessions

The previous disappearance was caused by treating browser presence and a short review deadline as availability authority. The new backend stores opening, closing and review deadlines separately from the tablet heartbeat. Browser navigation or a heartbeat older than 90 seconds does not end a trusted session. Server reads and reservation transactions enforce closing and confidence deadlines even after an application restart.

Default policy: eight-hour physical review, ten-minute preparation buffer, fifteen-minute pickup windows, six orders or sixty units per window. An owner can configure these within validated limits. Opening requires a physical review within five minutes and a closing time no more than twelve hours away. Increasing the review interval cannot silently extend existing confidence.

The staff screen distinguishes **Business**, **Customer availability** and **Truck screen**. A business session can remain Open while customer availability pauses for untrusted stock. Returning staff reload authoritative state. Offline changes are never queued; uncertain taps require an audit/stock refresh before retry. Manual Pause/Close is persistent. A new review is required when confidence expires, a shortage occurs or commitments need resolution.

## Kitchen interface

Ready in Display retains large quantity controls. In Oven supports multiple batches, quantities, revised estimates, partial readiness, protected reservations and cancellation of free stock. Expired timers say to check the oven. The queue shows set-aside food and pickup commitments; detailed tools retain the underlying workflows and audit history. The Android Control Agent remains a separate device-management component.

Fresh migration intentionally does not trust the existing staging entries. An actual staff member must check those counts, confirm stock review, choose closing time and Open. After that, tablet sleep alone does not close the kitchen. Counter sales must still be recorded and website allocations physically protected until automatic Square reconciliation is accepted.

## Validation and visual evidence

Final validation and hosted receipt are recorded in the acceptance addendum below. The suite covers ready/oven/mixed orders, full batches, changing ETAs, capacity, concurrency, partial readiness, delayed/cancelled batches, expired/failed/uncertain payments, idempotent events, refunds, recovery, authentication/permissions, network interruption and design preservation. Builds exercise the Hostinger-compatible Node 22/WASM standalone configuration over local HTTPS with a disposable MariaDB database.

Real hosted ingredient text revealed a mobile overlap during review; flexible content sizing now preserves the full description above the price. Tests include a long synthetic filling and assert no overlap at desktop/mobile sizes. Staff business and availability labels also received a regression assertion. The first unreviewed migration state correctly disables readiness actions until a physical review.

Screenshots are stored under `test-artifacts/unified-menu/screenshots`. `hosted-*` images show actual staging; synthetic images are explicitly test fixtures, not business availability. Before/after menu images and approved hero/Story comparisons are retained in the evidence backup. Dashboard chart improvements belong to the preceding kitchen-UX release; this release preserves them.

Physical Lenovo acceptance was **not completed**: USB interface access and the ADB listener were denied by the local environment. Touch-browser testing is not a substitute for Android sleep, Wi-Fi and touchscreen acceptance. [The tablet checklist](TABLET-ACCEPTANCE.md) records exact outstanding steps.

## Square and production release gates

The connected Square location read succeeded for the active CAD location, but catalogue reads returned `INSUFFICIENT_SCOPES` requiring `ITEMS_READ`. The returned location address is Victoria, while PUNA truck pickup is in Ucluelet; the intended catalogue/variation/location mapping still needs provider-level verification. No Square business record was changed and no real charge was made.

Before production launch: complete real Square Sandbox payment/webhook/refund/reconciliation acceptance; validate product/variation/location mappings; accept the counter-sale reconciliation workflow without double deductions; verify notification delivery using authorized test recipients; complete physical Lenovo acceptance; review operating hours/capacity and actual opening stock; obtain final launch authorization. Checkout, live payment and automatic POS gates remain disabled.

Hostinger still reports the inherited high-severity Zod advisory. The previously reviewed application collection-size/depth mitigation and its tests remain in place; this feature does not claim to patch the upstream dependency. See `docs/PRESTAGING_SECURITY_2026-11-08.md` for residual risk and the separate major-version compatibility proposal.

## Deployment, preservation and documentation

[DEPLOYMENT.md](DEPLOYMENT.md) records exact source/archive identities, migration checksum, existing-table fingerprints, fresh kitchen backup and application rollback. No destructive migration, official-site deployment, customer-message send or payment activation occurred. The original root checkout and previous checkpoints are retained; PR 4 remains a draft.

[IMPLEMENTATION.md](IMPLEMENTATION.md) documents the model, APIs, transactional rules, security and operational policy. [BACKUP-VERIFICATION.md](BACKUP-VERIFICATION.md) records final local/Drive readback and source/evidence integrity. The established website documentation and Tablet Project folders are reused rather than creating disconnected project folders.

## Final acceptance addendum

Final application: local `4a7f143ba9e373b3dc2b62860c0873fbb76c2693`, remote `4f46c5d37cb9b45e851f0cd932d9a0c382dd6607`, identical tree `d5b93fd5d2f267f05ccf87007814f665641cc4c5`.

- [Integration run 43367213003](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43367213003): success; **193 integration + 76 domain + 25 validation/provider-boundary checks**, zero failures. Typecheck and production standalone build passed. [Staging build run 43367218865](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43367218865) also passed. See CI-RELEASE.txt for individual results.
- Hostinger build `01a1d33a-402f-71f8-bc57-2f5434056f4c`: **Completed / Current**, deployed **12 November 2026 at 21:48 Pacific**, 1m 52s. Source `puna-unified-4a7f143-20261112.zip`. Target: https://staging.punaempanadas.ca/#menu .
- Hosted desktop 1440 × 1000 and mobile 390 × 844: one menu, five cards, no cabinet, no horizontal overflow, full descriptions clear of prices. Hosted tablet viewport 800 × 1280: no overflow; separate business/availability/device messages; unreviewed readiness actions disabled. No browser error logs observed on these pages.
- Hosted authenticated API: version 32, seven lots, 15 ready, 11 baking, zero allocations, 31 history events. Existing table checksums remained identical before migration, after migration and after final deployment.
- Hosted public API: all five products returned; preview enabled; availability paused for physical review; no product orderable; no active session closing time. This verifies safe preservation, not a claim that retained counts are physical stock.
- Approved hero and Story content/design signatures passed exact comparisons at desktop/mobile. Hero images were byte-identical; Story perceptual mean differences were about 0.20/255 with changed-pixel ratios 0 and 0.000198, below the defined thresholds. PNG bytes need not be identical when the browser resamples a crop.
- Actual hosted images: `hosted-menu-desktop-preview.jpg`, `hosted-menu-mobile-preview.jpg`, full-page equivalents, `hosted-kitchen-tablet.jpg`, `hosted-kitchen-tablet-preview.jpg` and `hosted-deployment.jpg`. Final synthetic before/after and mixed-checkout images use the `release-` prefix. Intermediate screenshots remain clearly named checkpoints.

The remaining production gates and physical-device limitations above are unchanged. Staff must perform the first real stock review and Open; the agent did not certify food or alter retained quantities.
