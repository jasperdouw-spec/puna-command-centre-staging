# Square catalog and pricing — architecture and operations

13 November 2026. Deployed and accepted on staging; this is not a production launch approval.

## Authority and location

Square is authoritative for current selling prices, item/variation identifiers and applicable provider tax configuration. PUNA retains product presentation, ingredients/allergens, photos, publication, schedules, stable internal identities and historical transactions. The kitchen ledger remains authoritative for physical display stock, baking batches and reservations. Catalog synchronization never adjusts kitchen stock.

Customer pickup is **Ucluelet only**, at the existing PUNA truck location. The owner explicitly confirmed this on 13 November. Square merchant Puna Foods Ltd. (MLW1CCS000T98) has one active location, Puna (LXTPDNGFCMPA2), used by the five most recent completed POS orders inspected on 12 November Pacific. Its provider address says Victoria. This is a discrepancy, not a second pickup destination. Do not change the production Square address without owner review. Catalog price mapping may use the verified POS identity with recorded evidence; live pickup checkout remains gated until the address is corrected and confirmed.

The existing Puna - Atlas integration OAuth grant was upgraded by the user. Hosted /api/sales readback at 2026-11-13T08:15Z confirmed ITEMS_READ plus MERCHANT_PROFILE_READ, ORDERS_READ, PAYMENTS_READ and REPORTING_READ, merchant/environment identity and successful reporting. No write scopes, charges or catalog mutations were requested.

## Data and synchronization

Migration 012_square_catalog adds six InnoDB tables: state, objects, links, runs, history and event deduplication. It does not seed or delete business products, inventory or orders. Provider objects are versioned evidence; links maintain unique stable product/variation associations. Normal UI remapping cannot repoint a historical product to another variation. New specials use separate identities; name/alias matches are suggestions only.

Every five minutes the existing authenticated reporting job also attempts catalog synchronization. Reporting and catalog have independent failure outcomes. PUNA_CATALOG_ENABLED=false pauses catalog polling without disabling reporting. A separate /api/catalog/jobs route shares the existing job credential. Every 24 hours, and on an owner-requested refresh, a full catalog reconciliation runs. Incremental requests use Square's latest_time watermark (never a local clock as provider cursor). Deleted and missing objects remain tombstones. Pagination, repeated cursors, malformed objects, changed equal versions and execution limits fail safely. All pages are fetched before one atomic database update. A dedicated catalog advisory lock prevents overlapping sync; updates share the existing commerce transaction lock.

Only fixed CAD prices at the reviewed location can update products. Variable, missing, non-CAD, archived, deleted, unsupported measurement and wrong-location entries retain their last verified value with an explicit warning and blocked commercial readiness. Owner drafts retain their descriptions/photos while their linked price updates. Price-only changes retain unchanged tax/deposit approval; changes to tax/modifier configuration invalidate it. Provider versions, hashes, timestamp, actor, prior value and new evidence are audited. Repeat events/syncs do not repeat price history.

Catalog freshness limit is 30 minutes. A failed sync blocks checkout until recovery; the website can keep displaying the last verified price. Publication requires a current mapped price; checkout additionally requires corrected Ucluelet provider address and reviewed taxes/deposits. Descriptions/photos do not depend on device heartbeat. Existing persistent kitchen sessions and stock confidence policies remain unchanged.

## Owner workflow and APIs

Menu & Products includes Square pricing & sync, connection/freshness status, exact variation mapping, provider-address discrepancy, source review and change history. Linked prices are read-only in the product editor. The Square Item Library link is the route to change authoritative prices. Advanced checkout settings cannot override linked prices/taxes/deposits. History restore restores presentation as a draft while retaining current Square price/identity.

- GET /api/catalog: owner-only sanitized catalog, mapping and history status.
- POST /api/catalog: same-origin bounded commands; sync/authorize/location/map/review. Mapping/review use UUID idempotency keys, expected generation and product versions.
- POST /api/catalog/jobs: constant-time shared job credential, scheduled gate.
- POST /api/sales/jobs: existing reporting plus independent catalog polling.
- POST /api/square/catalog-webhook: optional catalog.version.updated receiver; exact raw-body HMAC, merchant validation and event/body deduplication. Persists a refresh request; no stock or payment side effects. Requires explicitly configured SQUARE_CATALOG_WEBHOOK_SIGNATURE_KEY and SQUARE_CATALOG_WEBHOOK_URL. Polling works without this subscription.

Tax normalization supports explicit enabled additive subtotal percentage taxes only. Unsupported/inclusive/compound/product-set taxes and item modifiers require review. A missing tax object is never interpreted as exemption. Deposits are not inferred from a drink name, receipt price or supplier cost; their amount/taxability require a documented verified source.

## Payment boundary

No live payment adapter is enabled. Legacy Sandbox payment execution is restricted to the existing isolated synthetic acceptance boundary until provider-level Sandbox catalog acceptance is available. A production catalog cannot silently feed a Sandbox transaction. Direct Square revalidation is implemented before non-fixture quote/reservation; commercial readiness and current expected amounts must pass. Existing synthetic ready/oven/mixed-order, failed/uncertain payment, expiry, cancellation and fulfillment tests continue to exercise the reservation engine. This is not evidence that production payments are accepted.

## Reconciliation sources

Historical workbook: https://docs.google.com/spreadsheets/d/1nqTN_caifrz4-vN2482DLqXQ6SDDIe2dm7b4c5oZdK4/edit . Product Catalog, Square Raw Sales headers, Ingredient Master, Source Chimichurri, Recipe Costing and Source Register were inspected. Historical $3 Chimichurri/$3.50 drinks/$2 Chimicup values are reference evidence only. Recipe costs must never be imported as retail prices. Historical names/spellings are retained as aliases, not automatically merged identities. The detailed Chimichurri source uses a 30 g serving while another header says 70 g, and computed costing differs between tabs. Current portion/allergen details remain subject to review; do not label it allergen-free.

## Deployment and rollback

Use the existing Hostinger manual Node 22 source ZIP deployment, targeting staging.punaempanadas.ca only. Apply migration 012 after private backup and verify its SHA-256 ledger entry. Retain all existing tables and rows. Run exact-source CI, then package committed files, excluding credentials, private SQL and generated test artifacts. Preserve the current OAuth-compatible access release as rollback.

Rollback the application to the connection-only access release 3999699 (remote tree 77d11956147e0d4ae19fe4915f3e7890baa7704e), retaining all additive catalog tables and synchronized prices/history. Do not roll back to an older build that rejects the newly granted ITEMS_READ scope. Do not restore old inventory to undo an application release. If needed, disable catalog polling separately. Database recovery must first be exercised on an isolated database; never drop live tables to reverse this migration.

## Acceptance and remaining gates

Final release 37ca6cc (remote b09c169) passed 228 isolated integration checks, 92 domain checks, 25 boundary tests, image assertions, type checking and the standalone production build. All ten existing products are linked to active variations and current fixed CAD prices. Hosted automatic polling, explicit refresh, read-only price controls, duplicate-history prevention and unchanged kitchen/order checksums were verified. Desktop/mobile/tablet browser screenshots are retained. The hosted collation mismatch was fixed using a boolean verification condition; no global database collation changes were made.

Real catalog evidence includes GST with a product-set reference and drink PST. This unsupported tax model remains blocked pending provider validation; do not approve a replacement by guessing. Drink deposits and current Chimichurri ingredients/portion require review. No physical Lenovo or real Square Sandbox transaction acceptance is claimed. Checkout, live payments and automatic Square deductions remain disabled. See RELEASE-REPORT.md for exact release hashes, mapping table, backup receipt and remaining gates.

Google Maps regular hours were read directly and published through the existing Website editor. Other website settings were compared exactly and preserved. Published hours are informational; they do not automatically open a kitchen session or confirm stock.

Provider references: https://developer.squareup.com/docs/catalog-api/webhooks ; https://developer.squareup.com/reference/square/objects/CatalogObject ; https://developer.squareup.com/reference/square/objects/CatalogTax .
