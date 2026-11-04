# Unified staging integration and release boundaries

## Preserved presentation provenance
Public source: jasperdouw-spec/puna-empanadas commit 93112093172da08371b3b7d28af383ed2a947dff, recorded for magenta's archived deployment. Eighteen GitHub-sourced files (including the public component, CSS, supporting UI, runtime manifest, and all three image assets) were compared byte-for-byte against the private archived deployment source on the user's MacBook. The working files came from GitHub; no recovery archive, environment file, database dump, session or customer row was uploaded.

`app/globals.css`, supporting UI and three PNG/JPEG assets remain unchanged and are fingerprinted by tests/preserved-assets.json. The public JSX retains the deployed hero, menu, frozen range, story, location/hours, bag and footer. The old dashboard conditional was removed; team links use the unified authentication flow. Catalogue/settings now come from the shared Command Centre database. Test ordering has stronger session and default-off gates. Orbital styles are scoped to .workspace-theme to avoid changing the public design.

This is a tested integration rebuild, not a successful restore of the archived executable or databases. Current live magenta drift cannot be checked while Hostinger is unavailable. Manual visual acceptance remains required.

## Data and authentication
One SQL pool, users table and secure hashed session system serve public and authenticated pages. Roles come from active database accounts, never display names or browser claims. Both Jasper and José are intended to receive owner accounts through private setup/provisioning; no real account credentials are committed. Workers receive staff accounts. Existing manager roles are restricted to food-truck access, not owner controls.

There are no hard-coded deployed product fallbacks: public prices and availability are read from products. Display order preserves magenta's known IDs; additional products follow. Default website copy is the public-source copy until an approved migration or owner edit creates website_settings. Both interfaces share that row. Existing saved settings must be mapped before any hosted acceptance.

Test orders are stored only in test_orders with is_test=1. A single idempotent creation transaction snapshots current product prices and writes an audit event. Staff may advance New → Preparing → Ready → Collected; only owners may cancel. No customer contact, payments, account details or order totals appear in the worker projection. The UI and backend both label orders as tests.

## Current deployment and migration boundaries

The existing staging.punaempanadas.ca site and its assigned isolated MariaDB database are the only targets. The 4 November 2026 reporting release is approved, deployed and populated; see README.md and REPORTING.md. Migration 008 is applied and its ledger checksum is verified. Existing accounts, catalogue and audit history were preserved. Do not rerun seeds, recreate obsolete websites/databases, or provision a replacement database.

Review-branch pushes run synthetic CI only; main and Git auto-deployment remain unchanged. Future hosted changes require current-state inspection and the approval appropriate to those changes. The completed reporting approval is recorded in the existing private project records and must not be requested again for routine continuation of that scope. No startup/build applies SQL.

Private server reporting uses read-only production Square authorization. The five-minute Hostinger job calls the protected reporting endpoint with a private curl configuration outside public_html. It processes persisted pages without the Mac or chat. Payments, checkout, stock and production activation remain separate. Unverified source recipes and mappings must not overwrite owner-confirmed operational facts.

Migration 007 for customer notes remains unapplied and independent. Worker accounts, payment/fulfilment acceptance, recipe units/yields/costs and full hosted backup restoration need their own evidence. Synthetic CI does not prove private restore success. Keep real business data, credentials and recovery artifacts outside this public repository and CI.

The obsolete temporary sites and databases were removed in an earlier separately approved cleanup. Do not recreate them or interpret historical integration notes as current hosting targets. No further cleanup, DNS, mailbox or public-launch change is implied by this release.
