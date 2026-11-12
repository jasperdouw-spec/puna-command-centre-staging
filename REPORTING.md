# Reporting operation

The approved 4 November 2026 release extends existing Sales reports and Recipes & production. Migration 008, private server authorization, imports, reconciliation and scheduled refresh are complete on staging. Future hosted changes require their applicable approval. Real data and reconciliation evidence stay in existing private project records, outside Git and CI.

## Sources and schema

`008_reporting` adds twelve tables beside `historical_sales`. Run `node scripts/migrate.mjs --migration=008_reporting` for a plan. It checks migration 006's checksum, InnoDB parents and absence of conflicting extension tables. Only approved execution uses `--apply` and `PUNA_SCHEMA_APPROVAL=008_reporting`. Never run a seed. Migration 007 is independent. Startup and deployment never apply SQL.

CSV previews require the original 33 fields. SHA-256 identifies files; all 33 decoded field values determine duplicate identity before customer, card and note fields are discarded. Different original rows survive even when their minimized projections match. Publication and audit share one transaction; interrupted requests roll back and saved previews can be retried. Completed repeats are no-ops. Rejects block partial publication.

Item money uses integer CAD cents; quantities use decimals. Net excludes tax and tips, includes negative item returns and is not profit. Cash rounding remains separate from item revenue. Payment refunds and provider aggregates never enter or multiply item totals. Unsupported monetary structures and unitemized refunds require review. Product transaction counts are not additive. Missing periods are not zero. Legacy rows lacking provenance remain excluded.

CSV dates preserve Vancouver wall time, including ambiguous autumn times. API timestamps retain offsets and derive Vancouver dates. Reporting API local timestamps already encode location wall time; do not apply another timezone conversion. Queries verify their fields against current metadata. Currency floats are accepted only within a tiny serialization tolerance of exact cents, then stored as integer cents.

CSV/API identity or period overlaps are held out. Owner source choices are versioned and show separate totals. API replacement requires payment identity coverage for the entire CSV transaction. Changed API evidence invalidates previous choices and restores CSV pending review. A later CSV import also quarantines overlapping API facts. Product mappings never overwrite owner catalogue details.

Reference packages retain source links, hashes, dates, formulas and issues in `source_reference_versions`. Source recipes, ingredients, suppliers, purchases and operating assumptions are available for review. Unverified units, costs, yields and opening stock are not operational facts; owners verify these before creating a production recipe or movement.

## Private configuration

The hosted values below are configured privately. For an approved reconfiguration, preserve every existing runtime key:

- `PUNA_SQUARE_REPORTING_ENABLED=true`
- `SQUARE_REPORTING_APPLICATION_ID`, `SQUARE_REPORTING_APPLICATION_SECRET`
- `SQUARE_REPORTING_MERCHANT_ID`, comma-separated `SQUARE_REPORTING_LOCATION_IDS`
- `PUNA_REPORTING_ORIGIN=https://staging.punaempanadas.ca`
- `PUNA_REPORTING_ENCRYPTION_KEY`: random 32-byte key encoded in lowercase hex, with a private recovery copy
- `SQUARE_REPORTING_START_AT`: approved initial UTC boundary

Register the exact HTTPS `/api/sales/square/callback` URL in Square. An existing owner authorizes MERCHANT_PROFILE_READ, ORDERS_READ, PAYMENTS_READ and REPORTING_READ. The server verifies identity, country, currency and locations, encrypts tokens with AES-GCM and refreshes expiring tokens under a SQL lock. A semantic allowlist excludes business writes. Sandbox checkout remains separate and disabled.

Desktop PKCE/MCP helpers are separate. Credentials stay encrypted outside Git with restricted file permissions. The pinned MCP uses `DISALLOW_WRITES=true` plus read-only OAuth scopes. Local authorization does not configure the hosted server.

## Refresh and recovery

Hostinger supports Custom cron jobs and protected-route calls for Node.js: [official instructions](https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/). Active cadence: every five minutes, POST `/api/sales/jobs` with a private bearer header. Explicit activation sets `PUNA_REPORTING_SCHEDULE_ENABLED=true` and a random `PUNA_REPORTING_JOB_TOKEN` of at least 32 characters. Put the header in a permission-restricted curl config outside the public directory, never a URL or ordinary logs. Use a 55-second client timeout. This runtime does not depend on chat or the desktop.

Each request processes one provider page with a shared 40-second network budget, three bounded attempts, an exclusive lease and atomic records/cursor checkpoint. Refresh uses seven-day windows, 72-hour late-arrival overlap and a 15-minute freshness lag. Manual backfills allow up to 31 days. Updated-time filters discover changes to older sales. Complete history requires every approved update window. Failed pages can be retried or their cursor restarted without duplicating facts. Last success, failure codes, unfinished runs and coverage are visible; completing a scan does not resolve excluded records.

Before release approval, record a full private SQL export, checksum, table coverage and protected counts. Export existence does not prove restoration. DDL is not transactional: stop on partial failure and inspect definitions before repair. Never blindly drop or rerun tables.

Integration/browser tests use disposable GitHub-hosted MariaDB and synthetic data only. Real-source dry runs are separate evidence. Deploy only the exact tested archive. After approval, refresh backup/preconditions, apply additive SQL, preserve runtime values, deploy, authorize the server, import references and scan approved history. Verify protected records, repeated imports, owner views, health and disabled checkout. Stop on unexplained differences.

To roll back the application, disable scheduled reporting and redeploy the prior verified archive. Retain additive tables and audit history. Do not overwrite newer owner edits with a database restore; assess differences and rehearse in an isolated private target first. Full hosted restoration is not demonstrated by synthetic CI.


## Release evidence

Hosted code: `d1ba527640fe4edccc293e439255a3d6027df23b`; Hostinger build: `01a1a5df-b752-723f-92df-d1b0c939f330`. The exact archive passed 21 domain and 97 integration/browser/recovery checks on GitHub-hosted MariaDB 11.8.9 with the hosted collation. The completion path avoids mixed-collation comparisons, and diagnostics log only fixed stages and numeric database codes.

Private source reconciliation, repeated imports, owner views, preserved original records and disabled checkout were verified. The first automatic five-minute refresh completed on 4 November 2026 UTC. Read the existing private setup-status and execution receipt for exact imported counts, unresolved mappings, missing original CSVs, cron identity and backup evidence. Full hosted restoration remains untested; do not describe the SQL export or synthetic recovery tests as a successful private restore.


## Phase B dashboard, local implementation (8 November 2026)

The owner Sales reports tab now provides Day/Week/Month cards, a selected-metric trend, product shares/table/drill-down and an expandable source-review ledger. The new GET view is owner-only and executes in one read-only repeatable-read transaction. It never calls refresh/import APIs or changes stock. Existing source-review controls retain their existing explicit mutations; Reload view only reads.

Net sales sums included item net cents, already reflecting discounts and signed item returns; it excludes taxes/tips and is not profit. Transactions count distinct included transaction IDs (not lines); AOV is net divided by that count, and product transaction counts are nonadditive. Items sold is signed decimal quantity. Item refunds are shown separately without subtracting again. Payment-level refunds remain in source review. Tips are unavailable because no reconciled item allocation exists. Conflicting transaction identities withhold counts/AOV rather than knowingly merge identities. No records means unknown, not zero. Revenue/quantity donuts require nonnegative observed values with a positive sum; signed values remain visible in the table when a share is meaningless.

America/Vancouver periods use the runtime IANA timezone rules, including historical 23/25-hour days and later offset-rule changes. Day compares the same weekday last week; weeks start Monday and compare the previous week; months compare the previous calendar month. Ongoing periods match elapsed local dates/clock time; an ongoing month exceeding the previous month's length has no comparison percentage. Full months may have different day counts and are labelled calendar periods. Zero/negative/missing comparison baselines have explicit text instead of invented percentages. Hourly buckets use distinct UTC keys with local offset labels. Ambiguous imported wall times are excluded from hourly allocation and withhold partial-period totals; complete-period totals preserve the reconciled ledger.

Coverage remains explicitly incomplete even after a successful scan; empty buckets leave chart gaps. Global observed dates, unresolved mappings, held/excluded provider orders, legacy rows and unfinished scan counts stay visible. The view labels scan age over 60 minutes as needing attention and over 36 hours as stale/unverified (UI thresholds, not scheduler changes). Reporting has its existing 15-minute lag plus scheduling/provider delays and is never real-time stock. The observed ledger alone cannot certify complete historical coverage or profit.

At the Phase B checkpoint, hosted reporting freshness was unverified because Hostinger MCP required OAuth reauthentication. Phase D1 has restored read-only MCP access, with the remaining limits below. The saved 4 November success is historical evidence, not today's job state. No hosted imports, schedules or credentials were changed. See `docs/PHASE_B_CHECKPOINT_2026-11-08.md` for validation and release boundaries.

## Phase C stock boundary, local only (8 November 2026)

Live Kitchen uses counted ready stock and actual oven batches in a separate operational ledger with online/truck allocations. Historical sales never create stock; reporting imports never consume kitchen units. The local counter demonstration reserves ready units before Square payment, then explicitly confirms payment and handover in the worker screen. That handover retires physical units and their commitment in one transaction. Later reporting of the same sale must not deduct anything again.

No Square operational integration, reporting scope change, job change or provider activation is part of Phase C. A future POS integration needs stable provider event identity, deduplication and reconciliation before it can replace the staff acknowledgement. Real truck acceptance remains a prerequisite to online sales. Tests fingerprint existing inventory, orders and reporting rows around kitchen actions, but synthetic isolation does not verify today's hosted reporting freshness or coverage.

## Phase D1 read-only reporting recheck

Hostinger authentication succeeds. Existing five-minute cron remains configured. Latest visible output is `state=pending`, `phase=refunds`, `pages=1`, `records=67`, without execution timestamp or completed watermark. This is insufficient to establish latest success, errors, complete coverage or current freshness; it is not evidence that the schedule stopped. No job was run and no reporting configuration/scopes changed. [Current evidence and gaps](docs/PHASE_D1_HOSTINGER_READONLY_2026-11-08.md).

D1 customer orders use the Phase C physical ledger and separate fake payment identities. Reporting totals are not a stock source. Synthetic fingerprints prove D1 operations leave inherited reporting/legacy rows unchanged in the disposable database. Production reporting OAuth remains read-only and separate from the proposed D2 Sandbox application/token.

## Phase D2 read-only recheck — observed 9 November 2026 UTC

The same five-minute cron exists. Its latest observable output now reports run `dabdc72d-0bc8-486e-b905-25d7312be16b`, `state=complete`, `phase=refunds`, `pages=2`, `records=67`. This supersedes the D1 pending-output observation; the output still supplies no execution timestamp or completed watermark. Observation time is not execution time. Coverage, unresolved mappings, exception history and current health remain unverified. No job was invoked to obtain this result.

Hosted checkout remains disabled, anonymous Sales returns 401 and GET to the job endpoint returns 405. No hosted imports, data, scopes, credentials, schedules or environment settings changed. Production reporting source is unchanged from D1; its read-only access is not a Sandbox payment credential. See [D2 hosting/reporting limits](docs/PHASE_D2_BACKEND_CHECKPOINT_2026-11-08.md). Database assignment metadata does not reveal the current schema/migration ledger or prove a private restore; proposals remain unnumbered.

## Pre-staging hardening read-only recheck

A newer observable cron run, `8c7229e3-2808-4cd1-9b3c-0ce3efcc5fe2`, was first pending (refunds, 1 page, 67 records) and later complete (refunds, 2 pages, 67 records). Neither observation supplies an execution timestamp or watermark. This supports evidence of successive work but does not prove present freshness, full coverage or resolved mappings. No job or provider inspection was invoked. Hosted build/environment names/Git settings remain the prior archive configuration.

The candidate changes only reference-input collection validation in the Sales route; provider OAuth/scopes, ingestion, schedules, reporting SQL and stock separation are unchanged. To obtain health safely, an authorized owner can read the existing Sales source evidence/GET response or, after actual column inspection, run `db/inspection/reporting-readonly.sql` privately. Capture last success/attempt/error, watermark, run/window/cursor status and mapping/exclusion/coverage counts; avoid POST refresh/continue/backfill/inspect actions. A completed run alone remains insufficient. The [release plan](docs/PRESTAGING_RELEASE_PLAN_2026-11-08.md) preserves these checks and production read-only reporting.
