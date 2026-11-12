# Phase D1 — Hostinger read-only verification

Inspected 9 November 2026 UTC (8 November Vancouver). Authentication through the existing Hostinger MCP succeeds. No hosted setting, file, database, job, permission, scope or process was changed.

| Item | Current evidence / limit |
| --- | --- |
| Site | Existing enabled Node website `staging.punaempanadas.ca` |
| Completed build | `01a1a5df-b752-723f-92df-d1b0c939f330`; 4 November 09:24:24–09:26:32 UTC |
| Source | Manual archive `puna-reporting-d1ba527-20261104.zip`; API source commit/branch/repository fields are null. The label matches the documented reporting release; exact deployed source bytes were not independently recovered. |
| Runtime | Configured Node major 22; build logs identify Next 16.3.4. Exact running Node patch unknown. Historical build used WASM fallback after native SWC/glibc incompatibility; this inspection did not restart or repair it. |
| Git | `gitAutoDeployment: null`; no linked website repositories. No Hostinger site push trigger found. Broader repository automation was not independently audited; D1 remains local with no push. |
| Reporting job | Existing custom cron `IeuX73Te0c`, `*/5 * * * *`; private curl configuration retained; command/secret omitted. |
| Last visible output | Run `9bd070c2-8a50-4f8b-9603-3148656ef160`, `state=pending`, `phase=refunds`, `pages=1`, `records=67`. No execution timestamp or completed watermark accompanies this output. It does not establish current completion, freshness, failure or stopped scheduling. |
| Reporting gaps | Latest successful refresh, complete watermark, errors/incomplete-run history and date/location coverage could not be read through the available operations. No reporting job was run. |
| Database | Assigned database metadata visible: 257 MB / 3072 MB. No SQL/schema/migration-ledger inspection operation available; Node source is outside the document-root file listing. Installed engine/collation/schema and unused migration number remain unverified. |
| Backups | No hosting-backup inventory operation found. Current hosted backup and restore status remain unverified. |
| Dependencies | Hostinger scan returns 14 advisory records for Next 16.3.4, sharp 0.35.4, source-map-js 1.2.1 and Zod 3.25.76. This may be a periodic scan, not a fresh installed-tree audit. Remediation stays separate. |

Environment names were inspected with values masked: `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `DB_USER`, `NEXT_TELEMETRY_DISABLED`, `NODE_ENV`, `PUNA_REPORTING_ENCRYPTION_KEY`, `PUNA_REPORTING_JOB_TOKEN`, `PUNA_REPORTING_ORIGIN`, `PUNA_REPORTING_SCHEDULE_ENABLED`, `PUNA_SQUARE_REPORTING_ENABLED`, `SQUARE_REPORTING_APPLICATION_ID`, `SQUARE_REPORTING_APPLICATION_SECRET`, `SQUARE_REPORTING_LOCATION_IDS`, `SQUARE_REPORTING_MERCHANT_ID`, `SQUARE_REPORTING_START_AT`, `STAGING_TEST_ORDERS_ENABLED`.

Public HTTP readback returned `/` 200 with noindex/nofollow and approved website heading; `/api/puna` 200 with five products and “Andean roots. West Coast life.”; `/api/checkout` disabled with null provider application/location; anonymous `/api/sales` 401. `/robots.txt` is still 404 on the hosted release; the local Phase B implementation has not been deployed.

A separate clean browser session received HTTP 403 and “Checking your browser before accessing. Just a moment...”. That is a hosted browser challenge, despite successful authenticated MCP and public HTTP reads. Hosted visual acceptance remains incomplete.

Earlier Phase B/C statements about unavailable Hostinger OAuth are historical and superseded by this inspection. Their source branches and backup evidence remain unchanged. Sanitized API/HTTP/browser evidence is included in the D1 execution backup. Source/documentation backups are not hosted database backups.
