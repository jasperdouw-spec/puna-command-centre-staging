# Staging release — 9 November 2026 UTC

The exact approved pre-staging candidate is deployed successfully to `https://staging.punaempanadas.ca`. The native recovery gate passed before deployment. This was an **application-only staging deployment**: no SQL migration, seed, operational activation or production release occurred. This release record supersedes the earlier checkpoint's open recovery/deployment gates; those historical records remain unchanged.

## Release identity

| Item | Verified value |
| --- | --- |
| Source branch | `codex/puna-prestaging-20261108` |
| Source commit | `85bed7c71c6e5157abb9ba278ac5acc135c7a12d` |
| Archive | `puna-prestaging-85bed7c71c6e-20261108.zip` |
| Archive SHA-256 | `9eca16be0e1c0c74150bf374bdcff1b869e093d4ddc3aa887f4e7b2178680645` |
| Archive size / entries | 4,968,027 bytes / 230 |
| Hostinger build | `01a1bf32-8255-71fc-bc48-c41726b5bf48` |
| Build started / completed | `2026-11-09T07:25:20Z` / `2026-11-09T07:27:09Z` |
| Runtime and build | Node 22; npm build; Next application; root `.` (Hostinger readback null/default); output `.next`; manual archive |
| Deployed lockfile | Next 16.4.1; sharp 0.35.5; source-map-js 1.2.2 |
| Lockfile SHA-256 | `4baf7a5740feefbd16ebb843aa53415366ccb97604ece31df1b5afb0c7f0c528` |

The source branch, commit and archive remain unchanged. Documentation is on separate child branch `codex/puna-staging-release-record-20261109`; it is not a replacement deployment candidate. No Git push, merge, linked repository or auto-deploy was created.

Hostinger completed compilation, type checks, static generation, publication and application restart. Its native SWC/glibc warning used the successful WASM fallback. The deployed lockfile was downloaded and checked independently. No missing-table or automatic-migration error was observed. All 18 environment-variable entries and the reporting cron read back identically; the private runtime environment and cron configuration files also matched their pre-deployment SHA-256 hashes byte for byte. Database assignment stayed unchanged. Git auto-deployment is null and linked repositories are empty.

## Native recovery gate

The earlier phpMyAdmin export, SHA-256 `72cff5e06b95855ac9c1e1bb7a1ce36fb6fb330cc111e454bf0332cb53ab03d0`, remains **INVALID for complete recovery**. Its data/row digests, indexes, foreign keys and ledger matched, but it omitted nine CHECK constraints across five tables. Its original sealed evidence was preserved.

The replacement is `u291146170_puna_stage-native.sql.gz.age`, encrypted SHA-256:

`2c693be3aeeaf12ace5149d2e879676167c9c58a345b72c8862f344a08df7fc7`

The source was MariaDB `11.8.9-MariaDB-log`, inspected using the server's native MariaDB client 11.8.9/client 15.2 and `/usr/bin/mariadb-dump` 11.8.9/client 10.20. Capture ran from `07:11:41Z` to `07:11:48Z`. The dump exited zero with no stderr. Raw, compressed and encrypted sizes were 94,449,484 / 23,873,270 / 23,879,294 bytes. Hash readback, age decryption and gzip decompression all passed.

The all-InnoDB capture used `--single-transaction --quick --skip-lock-tables`, explicit `--routines --events --triggers`, `--hex-blob`, `--no-tablespaces`, UTF-8 MB4 and UTC preservation, with no native-definition-stripping compatibility option. The temporary client configuration was private and removed. SQL never entered the public web root. The compressed dump was encrypted on transfer; no plaintext local dump file was written. The encryption identity remains separate. No backup bytes, credentials or customer records are included in Git, ordinary Drive documentation or the source/evidence backup.

Before restore, all 45 native table definitions matched authoritative hosted `SHOW CREATE TABLE` output exactly. All nine CHECK expressions were preserved. Ledger rows 006 and 008, checksums, indexes and foreign keys matched; 007 and all 13 proposed C/D tables were absent. No database-target-changing statements or configured plaintext secrets were found in the dump.

A fresh MariaDB 11.8.9 container restored only this native backup, with networking disabled, no exposed ports, no application, events disabled and ephemeral tmpfs storage. The comparison passed for all table definitions, 381 columns, engines/collations, AUTO_INCREMENT values, all counts and protected data digests, 45 primary keys, 16 unique constraints, 49 foreign keys and 133 index-column entries. All 49 orphan checks returned zero. No views, triggers, stored routines or scheduled events existed on either side.

Each of the following nine CHECK constraints rejected a synthetic invalid update with MariaDB error 4025 in the isolated restore:

| Table | Enforced condition |
| --- | --- |
| `inventory_balances` | `committed_units <= physical_units` |
| `pickup_orders` | `total_cents = subtotal_cents - discount_cents + tax_cents + deposit_cents` |
| `pickup_order_lines` | `quantity > 0` |
| `service_batches` | `oven_committed <= oven_capacity` |
| `service_batches` | `packing_committed_seconds <= packing_capacity_seconds` |
| `service_batches` | `cutoff_at <= bake_at` |
| `service_batches` | `bake_at < pickup_at` |
| `service_batches` | `pickup_at < pickup_until` |
| `test_orders` | `is_test = 1` |

Those tests were rolled back and full equality was reverified. No negative test ran on staging. The exact labelled rehearsal container was removed after acceptance. The temporary SSH public key and remote dump were removed, the local task private key was removed, and hosting SSH was restored to its original INACTIVE state.

## Hosted acceptance

Public HTTPS, approved photographs and Andean copy, all five catalogue products, primary menu CTA, footer hierarchy, favicon, Open Graph image, branded 404, robots and sitemap passed. Page responses retain `noindex, nofollow`; the sitemap has no public URLs. Desktop 971px and mobile 390px/320px layouts were inspected with no horizontal overflow. The source archive URL returns 404 and the public document root contains no uploaded archive or database backup. Observed network traffic contained no analytics requests. The favicon asset returned HTTP 200; the automation extension's temporary favicon overlay was excluded from application evidence.

The normal owner session verified Today, Orders, Customers, Menu, Kitchen, Website, Team/settings, Sales Day/Week/Month, all four metric chart selections, product breakdown and product drill-down. Coverage warnings remained visible. No customer, order, catalogue, website, stock, team or operational record was edited for testing. Owner browser console checks found no application errors.

Ordering remains disabled, payment identifiers are null, all five add-to-bag buttons are unavailable, and the cart is empty. Live Kitchen GET/POST returns disabled/404; public availability returns disabled. Local fixture POST returns 404. Private anonymous API reads return sign-in-required/401; unsupported GET methods return 405 rather than exposing data. Private worker routes redirect anonymous users to sign-in.

The worker route was reviewed using the authorized owner session and showed the existing legacy operations screen with no verified service batches. The new Live Kitchen and local-ordering screens remain disabled. This does not claim acceptance with a separate worker identity, physical tablet, phone, camera, QR scan, payment or external email.

Actual hosted screenshots are retained privately for desktop/mobile/narrow homepage, footer, 404, disabled cart, owner navigation, Kitchen legacy safe view, worker safe view, Day, Week, Month and product drill-down. Public-page screenshots alone may be copied into the sanitized source/evidence backup; owner/reporting screenshots remain private.

## Reporting and post-deployment database

The existing five-minute read-only Square reporting cron continued without manual refresh, backfill, import, reconciliation or provider-authorization actions. The read-only post-release observation recorded last success `2026-11-09T07:35:03.070Z`, last attempt `07:40:01.859Z`, watermark `2026-11-09T07:15:02.127Z`, no failure code, and one routine pending refunds-page scan. These are timestamped observations, not a claim about later job state.

Reporting still labels coverage incomplete, with 47 unresolved mappings, 151 excluded/held provider orders, zero excluded legacy rows and a 15-minute freshness lag plus scheduling/provider delay. Included historical item rows were unchanged. Figures are observed reporting evidence, not certified totals, profit or live kitchen stock.

The post-deployment schema matched: 45 tables, 381 columns, all nine CHECK constraints, indexes/FKs, engines/collations and ledger `006_commerce` + `008_reporting`. Migration 007 and all 13 proposed C/D tables remain absent. No migration 009 was invented.

Protected digests for 42 tables were unchanged. Differences in three tables were independently attributed to scheduled reporting: six audit entries, three additional reporting runs, and connection scan timestamps/watermark. All new audit/run actors were null and their timestamps followed the unchanged cron. Earlier audit history, completed historical runs and stored reporting credentials were separately compared against the isolated baseline and matched. Only the audit AUTO_INCREMENT advanced, by six. Full private before/after counts, digests and SQL audit remain outside the repository. No unexplained difference remained and no database restore occurred.

## Rollback and remaining gates

No application rollback was needed. The verified rollback remains commit `d1ba527640fe4edccc293e439255a3d6027df23b`, Hostinger build `01a1a5df-b752-723f-92df-d1b0c939f330`, archive `puna-reporting-d1ba527-20261104.zip`, SHA-256 `50ee0015f226649ddfa2342d506d212e694e56c8c425369381690ec710dc8260`. Application rollback does not authorize restoring the database.

Separate gates remain for C/D hosted migrations and operational activation; verified stock, capacity and service schedules; real Square Sandbox payments/refunds; external email/callbacks; named physical devices and QR acceptance; Workspace/DNS/Business Profile/Search Console; privacy publication and GA4/GTM; production launch; Atlas handoff. The pre-staging residual Zod advisory and compatibility follow-up remain documented in `PRESTAGING_SECURITY_2026-11-08.md`; this release did not claim a Zod major-version remediation.

The existing PUNA Google reference receives an append with revision-guarded write and exact readback, preserving earlier text and the PACIFIC DOCSYNC region. The established Pacific Core PUNA documentation/backup directory receives a new, sanitized release backup and verified Git bundle. The private recovery evidence and prior sealed evidence have independent SHA-256 manifests. Final receipts are outside the immutable candidate under the project's `documentation` directory.
