# Unified staging integration and release boundaries

## Preserved presentation provenance
Public source: jasperdouw-spec/puna-empanadas commit 93112093172da08371b3b7d28af383ed2a947dff, recorded for magenta's archived deployment. Eighteen GitHub-sourced files (including the public component, CSS, supporting UI, runtime manifest, and all three image assets) were compared byte-for-byte against the private archived deployment source on the user's MacBook. The working files came from GitHub; no recovery archive, environment file, database dump, session or customer row was uploaded.

`app/globals.css`, supporting UI and three PNG/JPEG assets remain unchanged and are fingerprinted by tests/preserved-assets.json. The public JSX retains the deployed hero, menu, frozen range, story, location/hours, bag and footer. The old dashboard conditional was removed; team links use the unified authentication flow. Catalogue/settings now come from the shared Command Centre database. Test ordering has stronger session and default-off gates. Orbital styles are scoped to .workspace-theme to avoid changing the public design.

This is a tested integration rebuild, not a successful restore of the archived executable or databases. Current live magenta drift cannot be checked while Hostinger is unavailable. Manual visual acceptance remains required.

## Data and authentication
One SQL pool, users table and secure hashed session system serve public and authenticated pages. Roles come from active database accounts, never display names or browser claims. Both Jasper and José are intended to receive owner accounts through private setup/provisioning; no real account credentials are committed. Workers receive staff accounts. Existing manager roles are restricted to food-truck access, not owner controls.

There are no hard-coded deployed product fallbacks: public prices and availability are read from products. Display order preserves magenta's known IDs; additional products follow. Default website copy is the public-source copy until an approved migration or owner edit creates website_settings. Both interfaces share that row. Existing saved settings must be mapped before any hosted acceptance.

Test orders are stored only in test_orders with is_test=1. A single idempotent creation transaction snapshots current product prices and writes an audit event. Staff may advance New → Preparing → Ready → Collected; only owners may cancel. No customer contact, payments, account details or order totals appear in the worker projection. The UI and backend both label orders as tests.

## Deployment and migration gates — unexecuted
Only target the existing staging.punaempanadas.ca entry after current account, files, Git linkage/triggers, runtime environment and database assignment have been read back successfully. Do not create a website or delete an occupied entry. Review-branch pushes run CI only; main is unchanged.

The existing protected databases are not staging targets. Select or provision one dedicated isolated staging database with new private credentials after exact resource approval. Inspect its existing schema and data first. Apply db/004_product_versions.sql only if products.version is absent; verify its definition if present. Inspect the two new db/005 tables before proposing any DDL. Do not run db/002_initial_catalog.sql as a migration.

Preserved website IDs and Command Centre IDs may differ. Before a future approved data migration, prepare and privately review explicit source→target product mappings, settings fields, row counts and conflict decisions; preserve existing orders/audit/history and retire old sessions rather than copying production sessions. Do not silently merge duplicate products, overwrite saved content, or import real records into public CI. Recovery verification remains blocked and independent of synthetic tests.

After access/configuration verification: request separate exact database/schema approval and deployment approval naming the unified tested commit, existing site and verified hosting account. Credentials are entered privately. After private first-owner setup, remove bootstrap and verify rejection; provision the second owner and workers through the owner-only interface. Verify hosted HTTPS, roles, persistence, audit, desktop/mobile visuals and safe workflows before acceptance.

No cleanup is authorized. After unified replacement, data migration and recovery are verified, reassess each old site's file/database/email/domain dependencies and propose removals individually with exact resource/account/data-loss details and two separate destructive confirmations. Preserve private durable backups, required data, domains and mailboxes throughout. No old site is promised permanent retention or scheduled for automatic deletion.
