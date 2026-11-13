# PUNA Menu & Photo Studio — staging release report

Date: 2026-11-13 UTC. Scope: owner menu management, deterministic Photo Studio and unified-menu add-ons. Production, live payments and automatic Square deductions remain unchanged and disabled for this feature.

## Release identity

- Website: https://staging.punaempanadas.ca
- Owner entry: https://staging.punaempanadas.ca/workspace?view=menu
- Repository: jasperdouw-spec/puna-command-centre-staging
- Feature branch: codex/menu-studio-20261112; no unrelated merge. Draft PR: https://github.com/jasperdouw-spec/puna-command-centre-staging/pull/5
- Application local commit: 415648b88ba0e990194a89398f26991cc76ed781.
- Matching remote application commit: c6fdf3e63c19a82c696ef7975ad551b21f2afbea.
- Shared tree: 1d4fa4e1b86c236ef29a0806a86c137c4f2ca70e.
- Final archive: puna-menu-studio-415648b-20261113.zip; 292 committed files; SHA-256 2d53cff00044ed3cea21a25bd84eb0e240c648a2c82979f3e2f950ded8fda453.
- CI: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43383907466
- Final deployment: Hostinger reports Completed / Current for this exact ZIP (started 2026-11-13 00:15:54 in the dashboard’s displayed Pacific time).

## Delivered capabilities

| Area | Implementation and acceptance |
|---|---|
| Menu & Products | Existing owner workspace now supports product creation, names, descriptions, ingredients/allergens, prices, categories, visibility, drafts, explicit publishing, schedules, previews, history and restoring a prior version as a draft. Owner permissions are enforced server-side. |
| Photo Studio | Phone/tablet camera and library controls; content-validated JPEG/PNG uploads; orientation correction; restrained deterministic warm preset; 4:3 crop/zoom; alt-text review; six responsive WebP/JPEG derivatives; private originals and reusable photo library. |
| Persistent storage | Original and optimized image bytes live in additive MariaDB tables, outside deployment files. Versioned crops remain immutable. Published derivatives are cached; originals and unpublished derivatives require owner authentication. |
| Chimichurri | Existing stable chimichurri identity reused; ready-stock card and one-cup-per-two-empanadas bag suggestion implemented and tested with isolated fixtures. No automatic addition or charge. Existing staging product stays draft until its actual price, portion and ingredients are confirmed. |
| Drinks | One customer card groups published flavours, while each flavour retains its own product identity, price, stock and Square candidate. Existing four Sanpellegrino flavours remain drafts pending owner verification. |
| Weekly Special | Dedicated creation entry, dates, photograph, ingredients/allergens, preview and publication. Each new special has a new stable identity. Templates and archives preserve previous weeks and historical orders. Published active specials participate in existing ready and oven workflows. |
| Shopping bag | One existing bag, optional stock-aware sauce/drink suggestions, quantity/flavour controls and session dismissal. Mixed orders preserve separate allocations and a single pickup window; packing lists include add-ons. |
| Availability | Green Ready Now, red Not Ready with a separate unknown-count explanation, and amber In Oven with actual batch estimates. Elapsed timers require staff confirmation. |
| Kitchen | Existing persistent business sessions, reservations and batch ledger are retained. Sauces/drinks are ready-only; empanada specials can bake. A confirmed zero count is now accepted only for an empty display and cannot silently erase stock. |
| Approved design | Original cream/charcoal/amber cards, logo, imagery, hero, Story, navigation and analytics preserved. Screenshot regression checks compare desktop/mobile hero and Story. |

## Hosted acceptance

The first deployed build (04aa60d) successfully served the owner editor, photo library and customer status controls. An approved existing tray photograph was uploaded only to the private media library, never published as an individual product photograph. Its original is 354,251 bytes; the hosted default 640px WebP is 78,592 bytes (77.8% smaller). Crop adjustment produced another immutable set. All 13 stored original/derivative files matched their SHA-256 values, and all public_at values remained NULL.

Photo media ID: 355dd880-87b6-4357-b27c-9d519a22b446. The original SHA-256 is 678a1373ef973ad3ca2835580fa8871c53a504aae511b3e55b8f90cd1eca1e06. The photograph remains reusable in the owner's library. No real product name, description, price, publication status or stock count was changed during this test.

Final archive redeployment passed. The owner photo library reloaded the same media identity; all 13 file rows, sizes and hashes matched the pre-redeployment records, and the originals/derivatives remained private. The hosted /api/checkout response remained mode=disabled with null payment application/location IDs.

Current historical staging counts are displayed from the existing ledger. They were not reclassified as verified physical stock by this implementation. Existing overdue batches remain awaiting staff confirmation. Checkout still communicates that no real reservation or payment is taken on staging.

## Tests and visual review

The initial full standalone production suite passed in run 43381675047. Visual inspection then caught light text inheriting from the dark bag drawer onto the cream add-on panel; the final correction explicitly uses dark PUNA text and adds a computed contrast assertion (at least 4.5:1), plus a narrow-screen bag overflow check.

Final CI passed: 208 integration checks, 25 boundary tests, 76 domain checks across seven suites, and the Photo Studio deterministic processing assertions. Typecheck, production WASM/standalone build and recovery passed. Recovery verified 70 tables, 208 indexes, 80 foreign keys and 13 original/derivative image files.

Coverage includes owner/kitchen permissions, same-origin protection, bounded inputs, draft concurrency, idempotency, history, special schedules/expiration, stable drink identities, invalid image content, private originals, immutable crop publication, image survival after application restart, independent drink stock, stock-aware bag suggestions/dismissal, mixed special/oven/sauce/drink allocation and packing, preserved commitments after product expiration, failed/uncertain payments, refund/cancellation/expiry recovery, kitchen navigation/offline recovery, heartbeat-independent sessions, Square synthetic webhook/idempotency behavior, charts/reporting, production build/typecheck and binary-media database restoration.

Screenshots distinguish actual hosted acceptance from disposable synthetic fixtures. Synthetic golden colour blocks are test images, not invented product photography. Screenshot pairs verify approved hero and Story regions; analytics components and approved source assets were not edited by this release.

## Database, recovery and safety

Migration db/011_menu_studio.sql created five additive tables: menu_media, menu_media_files, product_menu, product_menu_history and menu_operations. Its SHA-256 is 439b3670d6c6c7cea09cebd20ad3d28d2d5a336fdb2e770e93451d5073385661. It was applied after a verified private pre-change backup. The schema-migration checksum matched; no product or stock seeding was performed.

Products, commerce_products, kitchen_events, kitchen_lots, kitchen_allocations and kitchen_allocation_lines had identical checksums before migration and after hosted image testing. The baseline contained 10 products, 33 events and 7 lots, with no allocations. During final readback, concurrent kitchen activity changed the events/lots checksums: the audit showed eggplant display adjustments at 07:17:50–51 UTC and a six-unit ham batch at 07:18:00 UTC. These staff operations were preserved; no rollback, deletion or reconciliation overwrote them. Product/commerce checksums remained unchanged.

Private local backup: test-artifacts/menu-studio/backups/pre-menu-studio-20261112.sql (28,877 bytes, mode 0600, SHA-256 1c500484cfab0c4386bba070a2b81a0372007053ef5d24d192157e61a3d5210d). No credentials are stored in ordinary documentation. Existing Hostinger backups and earlier deployment checkpoints remain intact.

Rollback: redeploy the preserved puna-unified-4a7f143-20261112.zip from test-artifacts/unified-menu/release-final-4a7f143/ (SHA-256 746e2bb97fddf67b2af19e9eeddcb4af7f98350dfbdb64abc4f4adf7a3eab836), retaining all additive media/history tables. Do not drop tables or restore old stock merely to roll back the application. Disposable tests verify feature-off retention and full binary-image backup restoration; no destructive private hosted-data restore was performed.

## Remaining release gates and limits

1. Actual Chimichurri price, portion/ingredients and four drink prices/content need owner confirmation. Recorded 300/350-cent draft values are not independently verified current prices. No invented special or false stock was published.
2. Square catalogue read lacks ITEMS_READ permission; provider variation/location mappings and sandbox/payment acceptance remain outstanding. Price locks and candidate validation prevent silent provider conflicts. Synthetic integration is not provider-level acceptance.
3. Live checkout, new-order intake, real charges, automatic Square deductions and synthetic hosted fixtures remain disabled. Production launch needs its separate acceptance and authorization.
4. Physical Lenovo touchscreen, camera, Android sleep and Wi-Fi acceptance are outstanding: ADB could not initialize its USB interface or local listener in this session. Browser touch simulation is verified separately. The PUNA Control Agent is unchanged.
5. JPEG/PNG are supported. HEIC/HEIF must be exported as JPEG until a validated decoder is installed. No generative image changes are used.
6. Media storage has a 256 MiB quota and 24-per-10-minute owner upload/crop rate limit. Originals and history are retained; automatic orphan deletion is deliberately not enabled. Recovery/export receipts are required before any approved cleanup.
7. One photo is published per product; the library retains multiple uploaded originals and crop versions. Product categories use the existing empanada/sauce/drink/internal-ingredient model.

## Documentation and evidence locations

Local root: /Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory/

- docs/menu-studio/IMPLEMENTATION.md — architecture, data/price rules and storage.
- docs/menu-studio/OPERATIONS.md — owner workflow, API, deployment, retention and rollback.
- docs/menu-studio/TABLET-ACCEPTANCE.md — precise physical-device checklist.
- docs/menu-studio/RELEASE-REPORT.md — this consolidated report.
- test-artifacts/menu-studio/ — source ZIPs, safe receipts and before/after screenshots; private backups remain separate.
- Website documentation folder: https://drive.google.com/drive/folders/11j4AaRxTnL0okaAGmuhYEj6v3wfoMv7F
- Tablet project folder: https://drive.google.com/drive/folders/1jsxbcrbHu5z_v3VcLVL-zVHsKtHMPUYP
- Owner guide: https://drive.google.com/file/d/1YrkvQlanmxBm2ncvZEZPRpMeMgGYXxij/view
- Tablet acceptance: https://drive.google.com/file/d/1Oe5NLMJVpFe1GbLY1xVQcd-xMd6QTeet/view

The release evidence archive contains the exact deployment source ZIP, safe test/migration/media receipts, hosted screenshots, approved before/after regions, and disposable menu/bag/weekly/tablet previews. Private SQL backups and raw authenticated browser snapshots are excluded. SHA-256/MD5 and Drive readback receipts are recorded in VERIFICATION.json beside this report. The established project reference receives a matching dated addendum; earlier checkpoints are retained.
