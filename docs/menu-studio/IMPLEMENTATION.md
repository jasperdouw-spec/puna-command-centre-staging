# Owner menu and Photo Studio — implementation checkpoint

Candidate branch: codex/menu-studio-20261112. Based on unified-menu local e95c091 / remote a2df034, identical source tree 99df95cda35687915f66cf9d08959653a048a236. Original checkout retained.

Fresh hosted inspection: current manual ZIP puna-unified-4a7f143-20261112.zip, Completed. Hostinger database MariaDB 11.8.9, max_allowed_packet 1 GiB; displayed database size 259 MB. No kitchen_square_mappings table installed. No production changes.

The existing product catalogue contains chimichurri at recorded 300 cents and four Sanpellegrino variations at recorded 350 cents. These are drafts with price_confirmed=0 and ingredients_confirmed=0; these amounts are NOT independently verified current prices. Preserve identities and draft status until the owner reviews them. Square connector catalogue read still returns INSUFFICIENT_SCOPES / ITEMS_READ. Never infer provider IDs or enable automatic deductions.

## Data and publication

Products remains the stable SKU and inventory identity. commerce_products remains publication/pricing/checkout configuration. product_menu adds draft content, ingredients/allergens, crop/alt description, special schedule and flavour labels. Each drink flavour is its own existing product; the customer card groups them. Each new special/template clone receives a new UUID-backed product ID. All existing order lines and ledgers remain untouched. Publication copies a reviewed draft atomically, with optimistic version checks, the shared commerce transaction lock, audit and idempotency keys. Draft edits do not alter published names/prices. Restoring history creates a draft, never rewrites orders. Scheduled visibility is evaluated by server UTC time in catalogue, availability and checkout; browser menu refreshes every 15 seconds and on visibility return. Existing allocations retain their lots after expiry/unpublication. Only owners can access editing and originals.

Square references are draft candidates; provider verification is a release gate. Changing a price linked by a candidate, Square source reference or installed kitchen_square_mappings is blocked, including the legacy product endpoint. New mappings cannot be published through a claim of verification. Existing sales_mappings and historical records are preserved.

## Photos

Explicit Sharp 0.35.5 dependency. JPEG/PNG signature + decoder validation; maximum 8 MiB and 48 million pixels; minimum 240×180; multi-page images rejected. HEIC/HEIF is not advertised: installed libheif supports AVIF input, not a validated HEIC camera pipeline. Native camera capture is an HTML file input, with library fallback.

puna-natural-warm-v1: auto-orient, convert to sRGB, flatten transparency to cream, bound working image to 2400 pixels, owner-controlled 4:3 crop/zoom, restrained brightness (0.97–1.06), saturation 1.025 and tiny red/blue warmth adjustment. No generative processing. Derivatives are 320/640/1280 WebP quality 82 and JPEG quality 84, metadata stripped by default. Exact crop versions are immutable. JPEG fallback and explicit dimensions prevent layout shifts. Local measurement with approved tray imagery converted to JPEG: 354,939-byte original → 71,222-byte 640px WebP (80% reduction); two reproducible processing passes ~853 ms on Pacific Core. Test results remain platform-specific.

Originals and derivatives live in additive MariaDB media tables, not the build/runtime filesystem. Originals are owner-authenticated, private/no-store attachments. Published derivatives receive immutable public cache headers and ETags. Unpublished derivatives remain owner-only. Originals and previous crops are never deleted by the application. Total media quota 256 MiB; owner processing rate limit 24 per 10 minutes and one decode per process. Quota exhaustion fails without deleting history. DB backup must include binary media bytes, and restores must verify original/derivative SHA-256s. Orphan cleanup is review-only until an export/restore receipt exists; retain originals and history-linked/public derivatives. Avoid executing purge SQL.

## Migration and rollback

011_menu_studio.sql adds five tables and does not seed or update existing products/stock. Use scripts/migrate.mjs with exact staging database guard after backup. Roll back application to the verified prior ZIP while retaining additive tables. Do not drop history or uploaded media as rollback. Existing approved assets are unchanged.

## Outstanding validation

Migration 011 applied to staging after verified private backup; all five tables created empty and migration checksum matched. Existing products, commerce products, kitchen events/lots/allocations checksums remained identical. Full CI and hosted deployment passed; photo upload, crop processing and persistence across redeployment were verified. Physical-device acceptance remains outstanding. See RELEASE-REPORT.md for exact release, CI and evidence references. Checkout, payments, automatic Square deductions and synthetic fixture flags remain disabled on hosting.
