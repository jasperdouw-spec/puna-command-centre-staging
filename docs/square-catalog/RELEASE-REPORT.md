# PUNA Square Catalog — staging release report
13 November 2026 · Customer pickup: **Ucluelet only**

## Delivered and verified

The Square catalog system is deployed to https://staging.punaempanadas.ca . Menu & Products now shows Square as the authoritative price source, current fixed CAD prices, variation identity, last successful check, mapping warnings and price history. All ten existing PUNA products have exact active Square variation links. Existing menu presentation, Photo Studio, Weekly Special editor, independent product identities, publication states, inventory and reservations are retained.

The existing OAuth application was upgraded through the user's Allow action. Hosted readback confirmed ITEMS_READ, MERCHANT_PROFILE_READ, ORDERS_READ, PAYMENTS_READ and REPORTING_READ for Puna Foods Ltd., merchant MLW1CCS000T98. No provider write scope or duplicate application was created.

The only active Square POS location is Puna, LXTPDNGFCMPA2. Recent completed register sales use that identity. **Its Victoria provider address is incorrect for PUNA pickup.** The mapping records that discrepancy explicitly; the approved customer location remains Canadian Princess, 1943 Peninsula Road, Ucluelet. No Square production business details were changed, and the address mismatch blocks commercial readiness.

## Current catalog reconciliation

Current provider catalog retrieval confirmed the following fixed base selling prices. These are not tax-inclusive totals or spreadsheet fallback prices.

| PUNA presentation | Stable internal ID | Current Square item / variation | Square variation ID | CAD |
| --- | --- | --- | --- | --- |
| Ají Chicken | chicken | Empanada Chicken / Regular | Y67PNUKIRBSEJQQPIANP6VDF | $8.00 |
| Carne | carne | Empanada Carne / Regular | GYQQC2HVQWS2ICLRWKV77S2F | $8.00 |
| Chimichurri | chimichurri | Chimichurri / Regular | 3MLJDO7662UGTUMSSY3KURIJ | $3.00 |
| Ham & Cheese | ham | Empanada Ham and Cheese / Regular | AJ2ZZ7XNJD36G6AWCYRQXTAP | $8.00 |
| Puna Strüdl | strudel | Empanada Apple / Regular | 34LP2T2MDTJQHGDMGLPVYENQ | $8.00 |
| Roasted Eggplant | eggplant | Empanada Roasted Eggplant / Regular | PIGYHZUXOZT4TJ4KDTI5H7NI | $8.00 |
| Sanpellegrino Aranciata | sanpellegrino-aranciata | San Pellegrino Aranciata / Regular | LO65SJDKRQMPEJTP3E4DCTFW | $3.50 |
| Sanpellegrino Aranciata Rossa | sanpellegrino-aranciata-rossa | San Pellegrino Aranciata Rossa / Regular | F7CSWPLATCAOVXNZY2RDVTO7 | $3.50 |
| Sanpellegrino Limonata | sanpellegrino-limonata | San Pellegrino Limonata / Regular | E5UE4AZ4UKFJ6SIXQ5IBRT56 | $3.50 |
| Sanpellegrino Pompelmo | sanpellegrino-pompelmo | San Pellegrino Pompelmo / Regular | 3DNTYOKB46FZVS26Q75AA5B2 | $3.50 |

The full initial import contained 76 catalog objects, including active and deleted records. Older misspelled San Pellegrino records were identified as deleted and were not linked. The historical $2 Chimicup name was not substituted for the active $3 Chimichurri. The four drink flavours retain separate stock and variation identities. Five empanadas remain published; Chimichurri and the four drink flavours remain drafts. No product was automatically published.

The catalog also contains a generic Empanada Special / Regular at $8. It remains unassigned. New Weekly Specials need a distinct appropriate variation; the mapping workflow refuses silent reassignment of an existing linked product. Square catalog creation requires separate provider write capability, which this release does not request.

José's workbook was reconciled for aliases, historical retail amounts and costing evidence. The active catalog confirms $3 Chimichurri and $3.50 drinks, while historical $2 Chimicup sales remain historical. Recipe costs are not selling prices. Current portions, ingredients and allergens remain unverified where source records conflict; the owner review consolidates these questions.

## Synchronization and safety

- Existing authenticated five-minute reporting jobs also check catalog synchronization. Independent successful automatic runs were observed at 08:55 and 09:05 UTC; manual full reconciliation succeeded at 09:14 UTC. Reporting and catalog failures remain independent.
- Full reconciliation runs daily and on owner request; incremental checks use Square's provider watermark. All pages validate before an atomic commit. Repeated cursors, conflicting versions, partial failures and unsupported prices fail safely.
- Only fixed CAD prices for the reviewed active register update linked products. Last verified values remain available for display after provider failures, with explicit warnings and checkout restrictions. A 30-minute freshness limit applies.
- Linked prices are read-only in the owner editor. Content/history restoration retains current Square prices and mappings. Advanced checkout settings cannot independently overwrite linked commercial data.
- A signed, idempotent catalog webhook receiver is implemented and tested synthetically. Its real provider subscription/signature configuration is not enabled; scheduled polling is operational.
- Direct provider price revalidation runs before non-fixture quotes/reservations. The legacy Sandbox payment path is explicitly gated until provider-level Sandbox catalog acceptance. No real payment was attempted.
- Catalog operations do not deduct stock. Ready stock, oven commitments, mixed pickup windows, expiry, cancellations and fulfillment remain in the existing inventory/ordering ledger.

The final repeated sync left exactly one location review, ten mapping confirmations and ten initial provider-price history events. It did not duplicate history.

## Hosted issue found and fixed

The first mapping transaction failed with MariaDB error 1267 (collation mismatch). It rolled back completely: zero links remained. The hosted database default differs from its Unicode table/client collations. Replacing the string comparison inside the verification timestamp update with a bound boolean resolved the hosted failure. A mixed database/client collation regression was added; the final build and all ten hosted mapping operations passed. No schema-wide collation conversion or destructive repair was performed.

## Opening hours from Google Maps

At the user's request, the current Ucluelet Google Maps listing was checked directly and the existing Website editor was used to publish:
- Monday and Wednesday–Friday: 11:30 am–4:30 pm.
- Saturday–Sunday: 11:30 am–6 pm.
- Tuesday: closed.

The copy identifies these as regular listed hours with holiday exceptions possible. Website settings advanced to version 2. Exact readback confirmed all other website fields were unchanged. This updates customer information only; it does not automatically open a kitchen session or certify stock. Source: https://www.google.com/maps/place/PUNA+Empanadas/@48.9448671,-125.5546107,17z/data=!3m1!4b1!4m6!3m5!1s0x548975f177bdb887:0x23e00bd43c5379e4!8m2!3d48.9448671!4d-125.5546107!16s%2Fg%2F11vjtggmmp

## Validation and evidence

Final exact-source CI: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43398240784
- **228 disposable integration checks passed.**
- **92 domain checks and 25 boundary tests passed**, plus image-processing assertions.
- TypeScript and the standalone production build passed using the Hostinger-compatible WASM compiler.
- Coverage includes catalog permissions, location mismatch, prices, variations, stable history, retries, atomic failures, stale recovery, webhook idempotency, tax-change invalidation, owner/staff restrictions, unchanged inventory, ready/oven/mixed orders, failed/uncertain payments, cancellation, responsive UI and synthetic database recovery.
- Approved hero/Story screenshot comparisons passed. Hosted customer menu, Ucluelet pickup, prices and existing stock/baking indicators were inspected.
- Owner pricing widths 1440, 800 and 390 pixels were checked without horizontal overflow. The hosted linked price field was verified read-only; the photo, schedule and history editor tabs remain present.
- Physical Lenovo camera/touch/sleep/Wi-Fi acceptance was **not performed**; ADB/device access was unavailable in this session. Browser responsive tests are not physical-device acceptance.
- Real Square Sandbox transactions and production provider tax/deposit acceptance were **not performed**.

Synthetic CI screenshots: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43398240784/artifacts/14023723235 (provider retention expires 20 November). Downloading that artifact was blocked in this session; hosted screenshots were saved locally instead.

Hosted screenshots under test-artifacts/square-catalog/:
- owner-pricing-desktop.jpg
- owner-pricing-tablet.jpg
- owner-pricing-mobile.jpg
- linked-price-editor-mobile.jpg
- customer-menu-desktop.jpg
- customer-menu-mobile.jpg
- ucluelet-pickup-hours.jpg
- before-owner.jpg and customer-hosted-baseline.jpg

## Data preservation

Migration 012_square_catalog created six additive tables. Its ledger checksum is 07bc2176c980fd9ebe7193430cbfb35cde6b95e72db1bfed282c856aa539672d. Existing product/commercial/stock/order checksums matched immediately before and after migration.

After all price links and a repeat synchronization:
| Existing table | Before checksum | After checksum |
| --- | --- | --- |
| kitchen_lots | 3090039591 | 3090039591 |
| kitchen_events | 3667111679 | 3667111679 |
| pickup_order_lines | 0 | 0 |

The existing displayed quantities were preserved, not treated as newly verified physical counts. No synthetic stock or paid order was inserted into staging.

## Deployment and rollback

Hostinger reports **Completed** for puna-square-catalog-37ca6cc-20261113.zip.
- Local application commit: 37ca6cc59b375d5036380ed67fce7707d26179ca.
- Equivalent remote commit: b09c169dcc1d9428650f8cfd31970c97c15ecb44.
- Matching source tree: 81c7244b54e1a0866e39715d26480217c18c5935.
- Branch: codex/square-catalog-20261113. No unrelated PR was merged.
- Source ZIP: 306 files; SHA-256 9a38fa1ee9845148d05e177bd260e0469228baa69318e4ddd2fd1fd547dabf0e.
- Node 22/manual source deployment; no environment or commerce activation flags changed.

For application rollback, redeploy the OAuth-compatible connection release 3999699 / remote 942527d, whose source tree is 77d11956147e0d4ae19fe4915f3e7890baa7704e. Retain the additive catalog tables, current stock, order history and synchronized prices. Do not deploy an older release that rejects ITEMS_READ. Polling can be disabled independently with PUNA_CATALOG_ENABLED=false if needed. Never restore stale inventory merely to undo application code.

The private pre-migration SQL backup is test-artifacts/square-catalog/backups/pre-catalog-20261113.sql (mode 0600), 3,219,376 bytes, SHA-256 03e3cfb568875364dfa8885aecb6398bca1819c57cc20ef5885cfb33432d346f. Its bytes were read back and matched the downloaded export. It excludes user/auth connection tables and is excluded from ordinary documentation/evidence bundles. Synthetic restore was tested; private hosted-data restore was not exercised.

## Remaining release gates

1. Correct/confirm the Square provider address for Ucluelet through the authorized owner.
2. Validate Square's GST product-set rule (and drink PST) with provider-level calculations; the current tax normalizer deliberately blocks unsupported product-set rules. Verify drink container deposits and rounding without inventing settings.
3. Confirm current Chimichurri portion/ingredients/allergens and drink commercial details, then approve publication of those drafts.
4. Complete provider-level Sandbox catalog/payment acceptance, physical Lenovo acceptance and final launch authorization. Production checkout, real payments and automatic Square stock deductions remain disabled.
5. Optional future work: configure the catalog webhook subscription, add provider catalog write permissions only when needed, and choose how Google special/holiday hours should be maintained. These were not activated automatically.

Architecture, API/security rules and owner workflow are in IMPLEMENTATION.md and OWNER-REVIEW.md. Tablet follow-up is in TABLET-ACCEPTANCE.md. Matching Pacific Core documentation is at /Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory/docs/square-catalog/ . The verification manifest records Drive readback and local archive integrity after saving.

