# Exact staging release, acceptance and rollback procedure

**Preparation only. Do not execute without explicit STAGING DEPLOYMENT APPROVAL.** This package proposes one final commit/archive, identified by `release-manifest.json` in the pre-staging evidence/backup directory. Its checksum is external to the source archive to avoid a circular hash. No push/merge/deploy, hosted migration, DNS change, Workspace purchase, external callback, Square transaction or email is authorized here.

Target: existing Node.js site **staging.punaempanadas.ca**, hosting account `u291146170`, order `1005762277`. Preserve the original/review and all B/C/D1/D2 branches and backups. The first release is website/dashboard/CRM compatibility review with Kitchen and ordering OFF. It is not customer ordering or truck acceptance.

## Current baseline and exact rollback artifact

- Current observed build: `01a1a5df-b752-723f-92df-d1b0c939f330`, completed 4 November 2026 at 09:26:32 UTC; source archive name `puna-reporting-d1ba527-20261104.zip`.
- Preserved local rollback archive: `/Volumes/PacificData/Projects/puna-foods/documentation/reporting-completion-candidate/puna-source.zip`, source commit `d1ba527640fe4edccc293e439255a3d6027df23b`.
- Rollback SHA-256: **`50ee0015f226649ddfa2342d506d212e694e56c8c425369381690ec710dc8260`**. All 143 file hashes verified against its manifest. Host storage availability of the old archive is unverified; do not rely on a deploy-history button without checking.
- Stored build settings: Node major **22**, app type **next**, root **.**, output **.next**, build script **build** (`npm run build` → `next build --webpack`), npm. Existing source is a manual archive, Git auto-deploy is null and linked repositories empty.
- Current remote main/PR and review-branch workflows contain build/test/artifact actions, no deployment. Broader repo/organization webhooks are not fully audited; avoid pushes as a deployment mechanism. Exact hosted Node patch/glibc are unknown; logs show x64 native SWC falling back to WASM.

## Before deployment

1. Read the final release manifest and execution receipt. Verify the candidate commit/branch, archive SHA, package-lock SHA, test results and preservation manifests. Confirm the owner approves **that exact archive** for this domain with new capabilities off. Never deploy a moving branch or rebuild an uncommitted worktree archive.
2. Re-read current Hostinger deployment/build, stored settings, environment **names**, Git auto-deploy/linked repos and cron. If the current build or configuration differs from the baseline, reconcile first; do not overwrite an intervening release.
3. Resolve the actual schema/ledger gate using `db/inspection/prestaging-readonly.sql` and [the database/restore procedure](PRESTAGING_DATABASE_AND_RESTORE_2026-11-08.md). Per the current brief, **unknown schema blocks staging deployment**, even for the feature-off candidate. No migration number is assigned by this package.
4. Verify a current private database backup and successful isolated restore under separate private-data authorization. Record exact hashes, dates, table/protected-record comparisons and rollback access. Historical November 4 exports and this source bundle do not satisfy that gate.
5. Verify the preserved rollback archive above, its local availability and ability to upload it again. Record protected current database counts/digests privately before any approved change.
6. Preserve the five-minute reporting cron (`IeuX73Te0c`, `*/5 * * * *`) and its private command. Capture last observable output plus private authenticated last-success/watermark/unfinished-run/error/coverage evidence. Do not invoke the cron or reporting refresh to improve the status. Keep all production reporting OAuth settings and scopes unchanged.
7. Confirm hosted `/api/checkout` says disabled, legacy test orders false, and no C/D/Sandbox/mail/fixture flag or secret has been added. Confirm noindex/nofollow, indexing-release constant false, GA4/GTM inactive and unapproved privacy route unpublished.
8. Review the residual Zod advisory and tested application mitigation in [the security note](PRESTAGING_SECURITY_2026-11-08.md). Verify current advisories again if approval is delayed. If a new finding affects the exact artifact, prepare a new candidate rather than altering this archive in place.

## Migration boundary

9. **Current action: none; blocked.** C/D files remain unnumbered proposals. Existing `scripts/migrate.mjs` does not accept them. After actual schema inspection, prepare and approve an exact additive/ALTER migration file, unused ID, checksum-bound preflight/apply commands, expected definitions/counts and a restore rehearsal. D1 includes ALTER statements; do not call it CREATE-only or assume instantaneous/fully transactional DDL.
10. The initial feature-off application requires no automatic C/D migration. If inspection determines a schema change is needed for this release, obtain separate exact SQL approval and complete its backup/preflight first. If no change is needed, record that verified conclusion and deploy application-only. Never run 001/002 seeds, fixture migration runners or startup SQL against hosting.
11. A later approved migration must reject partial/colliding schemas, verify FK types/engines/collations/indexes and protected data, apply only the approved checksum, and verify every expected postcondition. Do not improvise an apply command while the schema is unknown. Retain additive tables on application rollback; any destructive reverse SQL requires its own plan/approval.

## Application archive deployment — after approval only

12. Recompute the final archive SHA from the release manifest. The established packager includes only committed source and the disabled `.env.example`, excluding runtime `.env`, credentials, node_modules, `.next`, work and evidence. Do not upload the source Git bundle, database backup or whole worktree.
13. Use the existing **archive** deployment method. Discover the current `hosting_files_generate-upload-url` schema, targeting this exact username/domain. Keep returned upload URL/auth keys private and in memory. Upload only the final archive using the provider's TUS POST/PATCH protocol, verify returned upload offset equals file bytes, and retain sanitized acknowledgement. Do not switch to `hosting_deploy` from Git: it would configure auto-deploy.
14. Read detected settings with `hosting_nodejs_build-settings-from-archive` for the uploaded filename. Compare to the reviewed settings, then use the following structured `hosting_nodejs_start-build` request **with the exact `archive_path` from the release manifest**:

```json
{
  "username": "u291146170",
  "domain": "staging.punaempanadas.ca",
  "node_version": 22,
  "app_type": "next",
  "root_directory": ".",
  "output_directory": ".next",
  "build_script": "build",
  "package_manager": "npm",
  "source_type": "archive",
  "source_options": {"archive_path": "READ_EXACT_FILENAME_FROM_RELEASE_MANIFEST"}
}
```

15. Preserve the current environment without calling the full-replace environment API. It returns masked values; never write those masks back. Build installs locked dependencies with `npm ci` and `.npmrc` keeps required build tools available in production. The host applies its standalone wrapper; locally verified startup uses `.next/standalone/server.js` with copied public/static assets. The original package start remains `next start --hostname 0.0.0.0`; do not replace provider-managed start settings speculatively.
16. Poll `hosting_get-deployment` for the returned build UUID until completion/failure, using bounded backoff. A queued response is not success. Inspect exact installed versions, native-binary/WASM behavior and build logs without exposing environment values. Do not resend the deployment request just because a poll times out.
17. Re-read build identity, settings, environment names, database assignment, Git links and cron. Verify only the approved application build changed. No job, schema, seed or environment replacement is part of application deployment.

The 18 current environment names to preserve are:

```text
DB_HOST DB_NAME DB_PASSWORD DB_PORT DB_USER
NEXT_TELEMETRY_DISABLED NODE_ENV
PUNA_REPORTING_ENCRYPTION_KEY PUNA_REPORTING_JOB_TOKEN PUNA_REPORTING_ORIGIN
PUNA_REPORTING_SCHEDULE_ENABLED PUNA_SQUARE_REPORTING_ENABLED
SQUARE_REPORTING_APPLICATION_ID SQUARE_REPORTING_APPLICATION_SECRET
SQUARE_REPORTING_LOCATION_IDS SQUARE_REPORTING_MERCHANT_ID SQUARE_REPORTING_START_AT
STAGING_TEST_ORDERS_ENABLED
```

Do not add payment/mail/test credentials. Required effective defaults are disabled/absent: `PUNA_CHECKOUT_MODE`, `PUNA_LIVE_KITCHEN_ENABLED`, `PUNA_KITCHEN_PUBLIC_PREVIEW`, `PUNA_KITCHEN_FIXTURES`, `PUNA_ORDERING_LOCAL_ENABLED`, `PUNA_ORDERING_ACCEPT_NEW`, `PUNA_DISPOSABLE_LOCAL_TESTS`, `PUNA_D2_RELAY_ENABLED`, `STAGING_TEST_ORDERS_ENABLED`, bootstrap and provider fixture settings. Ordering's disposable-local gates must remain intact. Production reporting remains enabled only as already configured; it is not a payment adapter.

## Post-deployment API and browser acceptance

18. Verify HTTPS/certificate/redirects, real homepage content, noindex/nofollow and security headers, robots private-path exclusions, empty staging sitemap, custom 404, footer, preserved static/social images and exactly five approved catalogue products. Check `/privacy` stays unpublished; verify no GA4/GTM scripts or requests.
19. Check `/api/checkout` disabled, `/api/puna` test ordering/kitchen preview/local ordering false, Kitchen and public availability safely disabled, local-fixture/local-provider callbacks rejected, reporting jobs not invokable by anonymous GET, and Sales/owner APIs denied without authentication. Do not use attack payloads or trigger jobs on hosting.
20. In an existing authorized owner session, review Today and owner CRM navigation, Menu/Website/Customers and Sales Day/Week/Month/product drill-down. Read existing data only; do not save editors, import sources or create test customers/orders. Confirm database connectivity and expected missing-notes/schema behavior.
21. In an authorized staff session, verify owner/reporting denial and the safe food-truck legacy/disabled state. Live Kitchen controls, scanner flow, fake provider and ordering intake must not be available. Staff acceptance and physical-camera validation remain deferred.
22. Verify reporting GET evidence: last success/attempt/failure code, watermark, active run phase/pages/window, pending cursor indicator, unresolved mappings and included/excluded coverage. Do not use Authorize, Inspect provider, Refresh, Continue, Backfill, Import or Reconcile controls. Private SQL alternative: after column verification, run `db/inspection/reporting-readonly.sql`. Observed min/max dates and completed runs do not prove full coverage. Compare existing facts without creating stock movements.
23. Execute the visual matrix below. Store no auth cookies, raw QR/status credentials or private customer/financial screenshots in public evidence. Keep any necessary private views in approved private storage, with sanitized pass/fail notes in the release record.

| View | Exact review |
| --- | --- |
| Desktop homepage | 1440×1000; hero, preserved images, menu, story and pickup; no horizontal overflow |
| Mobile homepage | 390×844 plus 320px narrow check; nav, menu and bag controls; no overlap/overflow |
| Footer | Desktop/mobile full footer; contact/brand/link spacing; no unapproved privacy/analytics claim |
| Custom 404 | Unknown path returns HTTP 404 and branded navigation back to the site |
| Sales Day / Week / Month | Select each tab/date; labels, comparison periods, unknown/incomplete states and responsive charts |
| Product detail | Open/close drill-down, metric switch, sorting and preserved shared ledger totals |
| Owner CRM | Today, Orders, Customers, Menu, Kitchen, Website and Team/settings according to role |
| Worker page | `/food-truck` with authorized staff; Kitchen operational feature off, no simulated ordering controls |
| Customer ordering | `/cart` disabled notice; no card form, live payment, fake-provider action or intake |

24. If Hostinger challenges automation, use the owner's normal authenticated browser and complete the normal challenge manually, then perform the read-only checklist. An owner-controlled local browser may be used with their existing session, without exporting cookies into tools/artifacts. Record the actual browser/version/time and evidence limits. A private local Linux replica can supplement layout checks but does **not** replace hosted acceptance. Do not disable WAF/bot protection, create global bypasses or make admin routes public.
25. Record acceptance against the exact hosted build. If a critical item fails, stop acceptance and follow rollback; do not activate providers to make a check pass. Device/Sandbox/email tests, Workspace/DNS, Business Profile, Search Console and analytics remain deferred.

## Rollback

26. Roll back the **application** for persistent startup/5xx failures, auth/role/security regression, missing assets/critical UI, unexpected active checkout/fixture endpoints, database compatibility errors or reporting disruption introduced by the candidate. Preserve sanitized logs and build identity first. If exposure or data integrity is uncertain, contain the affected feature via separately approved runtime controls and escalate; do not silently discard records.
27. Re-upload the verified prior archive above using a distinct approved rollback filename, then start an archive build with the same preserved Node22/Next/.next/build/npm settings. Verify SHA before upload and poll the returned rollback build. This rebuilds the known prior source; it is not proof of byte-identical historical runtime dependencies/cache. No environment replacement, cron change or SQL rollback is implied.
28. For this initial feature-off release no new paid commitments should exist. Preserve all current database rows and any additive tables; do not DROP candidate tables or restore an old database over newer data. Reverify HTTPS, auth, prior reports, disabled checkout, cron/settings and current record baselines.
29. If ordering is later activated, stop **new intake** while keeping paid/uncertain commitments, status access, reconciliation and staff fulfilment available. The old reporting-only release may not serve those obligations; do not blindly roll back to it. Prepare a compatibility-aware containment/recovery plan and explicit stock disposition first. A refund never automatically returns food to available stock.
30. Record outcome, exact build/archive, evidence and remaining gates in repository/Drive/private backup receipts. Stop after this release review; no production launch follows automatically.
