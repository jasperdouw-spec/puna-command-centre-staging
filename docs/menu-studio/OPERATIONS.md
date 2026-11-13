# Menu & Products — owner guide and recovery

## Everyday owner workflow

Open Workspace → Menu & Products. Kitchen staff cannot open this area. Choose an existing product or New product. Edit the description, ingredients/allergens, category and CAD price. Save draft leaves the currently published menu unchanged. Preview the draft, check the confirmation box after reviewing it, and Publish to menu. Do not confirm a price or recipe from an old source without checking current business information.

For a photograph, open Photo Studio, take or upload a JPEG/PNG, review the automatic warm treatment, adjust horizontal framing, vertical framing and zoom, then Apply crop & preview. Review the suggested alt text. Save draft or publish the product. The private original and all earlier crop versions remain available. A published image is publicly cacheable; unpublishing a product does not revoke an image already delivered to a browser.

Photos & PUNA Photo Studio lists the library and authenticated original downloads. HEIC/HEIF requires export as JPEG first. Maximum 8 MiB; very large, animated, malformed and unsupported images are rejected. Total media storage is capped at 256 MiB. A full quota requires a storage/backup review; uploads never delete previous photos to make room.

Create a special using Create a special, give it its own name/recipe/price and an actual start date. End date is optional. Save, preview and publish. Start/end times are entered in the device timezone (displayed in the editor) and stored as UTC. Use as a new special copies an earlier product into a new draft identity. Do not rename an old special into a different recipe: that loses the useful distinction between products even though order snapshots remain protected.

Each drink flavour is a separate product and stock identity. Select Drinks & flavours → Add a drink flavour, enter its flavour label and reviewed commercial details. Published flavours share one customer card with a flavour selector. Sauce/drink stock is Ready in Display only. Normal ingredients are internal catalogue records, never oven products.

Visibility & schedule provides Unpublish and Archive. Both stop new menu ordering without deleting allocations, lots or history. Product History → Restore as draft restores earlier details for review; publication is a separate explicit action. A version conflict means another change was saved: reload and review rather than overwriting it.

## Operational gates

The existing Chimichurri and four Sanpellegrino records are preserved private drafts with unverified prices. This release does not certify their recorded amounts, tax/deposit rules, recipes or physical stock. Publishing needs owner review; checkout additionally requires the established commercial configuration and trusted ready stock. A special appears only during its published schedule. Its committed orders remain in fulfillment after it ends.

The shopping bag suggests one small Chimichurri cup for every two empanadas, capped by currently unreserved ready stock. Neither sauce nor drink is added without a customer action. Dismissal persists for the current browser tab session. A bag reserves nothing; checkout revalidates every item, price and lot atomically. Prices shown in an older bag are estimates until checkout revalidation. Checkout and automatic Square deductions remain disabled on hosted staging.

Square references are candidates only until verified through the provider. Owner editing never calls Square catalog writes. Existing mapped prices cannot change through either editor or the legacy product API. A missing provider mapping is a release blocker, not permission to guess a variation ID or silently substitute another product.

## API contract

All responses are no-store except explicitly published immutable image derivatives. Authenticated mutation routes require same-origin requests; owner role required throughout menu editing and private media access.

| Route | Behavior |
|---|---|
| GET /api/menu | Existing products, editable drafts, publication metadata and latest 400 history entries |
| POST /api/menu | create/save/publish/unpublish/archive/restore/clone; UUID idempotency key; existing changes require current product version; publish requires reviewed confirmation |
| GET /api/menu-media | Private gallery, crop variants, storage usage/quota and accepted formats |
| POST /api/menu-media | Binary JPEG/PNG upload up to 8 MiB, or JSON `{id,crop:{x,y,zoom}}` reframe request |
| GET /api/menu-media/:id/original | Authenticated original download, private/no-store |
| GET /api/menu-media/:id/:crop-:width.webp or .jpg | Owner-only before publication; published derivatives use immutable caching and ETag |
| GET /api/puna | Existing customer catalogue extended with approved media, ingredients, allergens, flavours, specials and server-evaluated schedule |

Conflicts return 409; unauthenticated/unauthorized access returns 401/403; invalid fields/images return 400; oversized streamed upload returns 413; processing/rate limits return 429. No failed image upload creates a partial media row. Failed/uncertain commercial payments remain governed by the existing checkout safeguards.

## Backup, retention and rollback

1. Before migration, export products, commerce_products, schema_migrations and affected kitchen ledger/state tables. Record file byte count and SHA-256; keep the export private. Do not put private SQL into Git or ordinary Drive reports.
2. Migration 011 adds five tables only. Verify its checksum and expected table presence. Do not overwrite existing product/stock rows. The existing migration runner guards the database target and detects ledger/schema disagreement.
3. After owner uploads begin, include menu_media, menu_media_files, product_menu, product_menu_history and menu_operations in database backups. Binary blobs must be exported intact (hex representation is suitable). Restore to a disposable database and compare SHA-256 of originals/derivatives to stored hashes before relying on a backup.
4. To roll back the application, redeploy the preserved prior staging ZIP. Retain additive tables; old application code ignores them. Uploaded photos and editing history survive rollback. Restore the current release later to regain the editor. Never drop media/history as an application rollback.
5. Orphan review: identify media not referenced by published product_menu.photo_id, any draft.photoId, or any history snapshot photoId. Publicly delivered derivatives and all originals remain retained. Export and verify recovery first. No automatic purge is installed; deletion requires a separately reviewed retention decision. This deliberately prevents accidental loss through ordinary photo replacement.
6. Retain prior source ZIPs, manifests and reports. A successful browser refresh alone does not prove restart persistence; use the integration restart test and hosted redeployment verification.

## Lenovo acceptance

Automated tests use Chromium touch input and responsive tablet/mobile viewports. Physical camera capture, Android file picker, real touch behavior, screen sleep and Wi-Fi recovery require the Lenovo. ADB is blocked in this session by USB interface initialization and listener permissions. Do not claim physical-device acceptance from browser emulation. The PUNA Control Agent is unchanged and remains separate from inventory authority.
