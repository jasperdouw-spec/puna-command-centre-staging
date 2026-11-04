# Reporting operation

This candidate extends existing Sales reports and Recipes & production. Hosted migration, import, configuration and deployment require the exact release approval. Real data and reconciliation evidence stay in existing private project records, outside Git and CI.

## Sources and schema

`008_reporting` adds twelve tables beside `historical_sales`. Run `node scripts/migrate.mjs --migration=008_reporting` for a plan. It checks migration 006's checksum, InnoDB parents and absence of conflicting extension tables. Only approved execution uses `--apply` and `PUNA_SCHEMA_APPROVAL=008_reporting`. Never run a seed. Migration 007 is independent. Startup and deployment never apply SQL.

CSV previews require the original 33 fields. SHA-256 identifies files; all 33 decoded field values determine duplicate identity before customer, card and note fields are discarded. Different original rows survive even when their minimized projections match. Publication and audit share one transaction; interrupted requests roll back and saved previews can be retried. Completed repeats are no-ops. Rejects block partial publication.

Item money uses integer CAD cents; quantities use decimals. Net excludes tax and tips, includes negative item returns and is not profit. Cash rounding remains separate from item revenue. Payment refunds and provider aggregates never enter or multiply item totals. Unsupported monetary structures and unitemized refunds require review. Product transaction counts are not additive. Missing periods are not zero. Legacy rows lacking provenance remain excluded.

CSV dates preserve Vancouver wall time, including ambiguous autumn times. API timestamps retain offsets and derive Vancouver dates. Reporting API local timestamps already encode location wall time; do not apply another timezone conversion. Queries verify their fields against current metadata. Currency floats are accepted only within a tiny serialization tolerance of exact cents, then stored as integer cents.

CSV/API identity or period overlaps are held out. Owner source choices are versioned and show separate totals. API replacement requires payment identity coverage for the entire CSV transaction. Changed API evidence invalidates previous choices and restores CSV pending review. A later CSV import also quarantines overlapping API facts. Product mappings never overwrite owner catalogue details.

Reference packages retain source links, hashes, dates, formulas and issues in `source_reference_versions`. Source recipes, ingredients, suppliers, purchases and operating assumptions are available for review. Unverified units, costs, yields and opening stock are not operational facts; owners verify these before creating a production recipe or movement.

## Private configuration

After approval, preserve existing runtime keys and add:

- `PUNA_SQUARE_REPORTING_ENABLED=true`
- `SQUARE_REPORTING_APPLICATION_ID`, `SQUARE_REPORTING_APPLICATION_SECRET`
- `SQUARE_REPORTING_MERCHANT_ID`, comma-separated `SQUARE_REPORTING_LOCATION_IDS`
- `PUNA_REPORTING_ORIGIN=https://staging.punaempanadas.ca`
- `PUNA_REPORTING_ENCRYPTION_KEY`: random 32-byte key encoded in lowercase hex, with a private recovery copy
- `SQUARE_REPORTING_START_AT`: approved initial UTC boundary

Register the exact HTTPS `/api/sales/square/callback` URL in Square. An existing owner authorizes MERCHANT_PROFILE_READ, ORDERS_READ, PAYMENTS_READ and REPORTING_READ. The server verifies identity, country, currency and locations, encrypts tokens with AES-GCM and refreshes expiring tokens under a SQL lock. A semantic allowlist excludes business writes. Sandbox checkout remains separate and disabled.

Desktop PKCE/MCP helpers are separate. Credentials stay encrypted outside Git with restricted file permissions. The pinned MCP uses `DISALLOW_WRITES=true` plus read-only OAuth scopes. Local authorization does not configure the hosted server.

## Refresh and recovery

Hostinger supports Custom cron jobs and protected-route calls for Node.js: [official instructions](https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/). Proposed cadence: every five minutes, POST `/api/sales/jobs` with a private bearer header. Explicit activation sets `PUNA_REPORTING_SCHEDULE_ENABLED=true` and a random `PUNA_REPORTING_JOB_TOKEN` of at least 32 characters. Put the header in a permission-restricted curl config outside the public directory, never a URL or ordinary logs. Use a 55-second client timeout. This runtime does not depend on chat or the desktop.

Each request processes one provider page with a shared 40-second network budget, three bounded attempts, an exclusive lease and atomic records/cursor checkpoint. Refresh uses seven-day windows, 72-hour late-arrival overlap and a 15-minute freshness lag. Manual backfills allow up to 31 days. Updated-time filters discover changes to older sales. Complete history requires every approved update window. Failed pages can be retried or their cursor restarted without duplicating facts. Last success, failure codes, unfinished runs and coverage are visible; completing a scan does not resolve excluded records.

Before release approval, record a full private SQL export, checksum, table coverage and protected counts. Export existence does not prove restoration. DDL is not transactional: stop on partial failure and inspect definitions before repair. Never blindly drop or rerun tables.

Integration/browser tests use disposable GitHub-hosted MariaDB and synthetic data only. Real-source dry runs are separate evidence. Deploy only the exact tested archive. After approval, refresh backup/preconditions, apply additive SQL, preserve runtime values, deploy, authorize the server, import references and scan approved history. Verify protected records, repeated imports, owner views, health and disabled checkout. Stop on unexplained differences.

To roll back the application, disable scheduled reporting and redeploy the prior verified archive. Retain additive tables and audit history. Do not overwrite newer owner edits with a database restore; assess differences and rehearse in an isolated private target first. Full hosted restoration is not demonstrated by synthetic CI.
