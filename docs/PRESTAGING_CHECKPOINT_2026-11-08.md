# Pre-staging hardening checkpoint — preparation, not deployment

Branch `codex/puna-prestaging-20261108`, worktree `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-prestaging`, exact D2 parent `b6e48ddebb625dc8c0c1adda0322c7abdcb35fc5`. The complete B → C → D1 → D2 chain was verified; original/review and all four phase worktrees remain clean at their preserved commits. No local main ref exists and no remote branch was modified. Final commit, clean state, unique archive filename, archive SHA and lock SHA are in the external `prestaging-20261108-release-manifest.json` and execution receipt. Only that final archived commit is the proposed release.

## Security result

Next 16.3.4 → **16.4.1**; sharp 0.35.4 → **0.35.5**; source-map-js 1.2.1 → **1.2.2**. React remains 19.2.6, Zod remains 3.25.76. A current full-lock advisory query returns **14 records before, one high Zod record afterward**. No override, automatic audit fix or broad upgrade. All 17 application array schemas now reject oversized input before element parsing, with 25,000-node/depth-16 aggregate bounds; normal outputs and generic HTTP errors remain. Large reference batches may need splitting. This mitigates the known application exposure without claiming the package is patched. Zod 4 remains a separate compatibility proposal, not installed in the application. Static build generation is bounded to one worker. [Detailed versions, evidence and residual risk](PRESTAGING_SECURITY_2026-11-08.md).

## Validation and exact commands

```sh
export PATH="$PWD/work/runtime/node-v22.23.4-darwin-arm64/bin:$PATH"
npm ci --no-audit --no-fund
npm run typecheck
npm run build
PUNA_LOCAL_DOMAIN_TESTS=true node tests/domain.mjs
PUNA_LOCAL_DOMAIN_TESTS=true node tests/sales-domain.mjs
node tests/sales-dashboard-domain.mjs
node tests/kitchen-domain.mjs
node --test tests/d2-boundaries.mjs tests/validation-boundaries.mjs
node tests/run-local-disposable.mjs
git diff --check
# After committing the final source:
python3 scripts/package-source.py test-artifacts/prestaging
node tests/run-linux-package.mjs test-artifacts/prestaging/puna-source.zip
```

- **41 domain checks:** commerce/costing 12, sales 9, dashboard/calendar 11, kitchen 9.
- **25 boundary checks:** D2 guards/relay 17 plus validation mitigation 8.
- **171 integration/browser/recovery checks:** D1 checkout/payment simulations, original B/C behavior, feature-off/legacy orders, QR/security/races, notifications/restarts and synthetic restore of 59 tables, 183 index entries and 68 foreign-key entries. No existing database is used. QR screenshots are suppressed.
- **20 production-like Linux checks:** exact archived source, production `npm ci`, typecheck, webpack/WASM build, standalone startup, x64 native sharp/JPEG/SVG conversion, static/social images, cold/warm assets, 404, robots/sitemap, auth/role boundaries, dashboard Day/Week/Month/product details, feature-off Kitchen/availability/checkout, unavailable fixtures, owner/worker browser views, desktop/mobile layout and absent analytics requests. Browser is Mac Chrome driving the Linux server through loopback TLS; this is not physical-device or hosted browser acceptance.
- Linux image is pinned Node 22.23.4 Debian x64, glibc 2.36, npm 10.9.9; native sharp 0.35.5/libvips 8.18.7. Build uses the hosted WASM fallback path; native SWC loading is checked separately. Application runtime has no PUNA/Square/Google/bootstrap/test-order environment variables and no fixture preload. Its owned synthetic database has no C/D schema, proving safe disabled behavior. Only its labelled containers and temporary TLS files are removed.

The first native-emulated Linux run compiled/typechecked then hit a SIGSEGV page-data worker; a three-worker WASM retry exited 137. The constrained Docker VM reported about 2.8 GiB shared capacity. After bounding build workers to one, the build passed. An initial smoke assertion incorrectly expected public availability to return 404; the actual safe contract is HTTP 200 with `{enabled:false}`, and the assertion was corrected. Cart review now populates a synthetic bag so the disabled notice is exercised; cookie checks are order-independent and dashboard screenshots wait for the detail chart. Failed attempts are retained separately. The final receipt must show a fresh complete run against the final archive; prior or smoke-only retries do not substitute for it.

Hosted OS/glibc/Node patch, current private data, actual providers, real inboxes, physical cameras and staff workflow remain untested. Current host logs show x64 native SWC cannot resolve GLIBC_2.29 and uses WASM. A Debian test cannot prove exact Hostinger binary compatibility; inspect the separately approved hosted build and acceptance afterward.

## Hosting, reporting and database

Read-only Hostinger access identifies the same Node site/account and November 4 build `01a1a5df-b752-723f-92df-d1b0c939f330`, archive `puna-reporting-d1ba527-20261104.zip`. Node major22/.next/build/npm and the same 18 environment names remain; values stay masked. Git auto-deploy is null, linked repos empty, reviewed remote workflows have no deployment steps. Wider organization/repository hooks remain unverified, and nothing was pushed.

Hosted checkout is disabled, public noindex/nofollow present, legacy test ordering false, Sales anonymous access 401, GET job access 405 and local fixtures 404. No job was invoked. New run `8c7229e3-2808-4cd1-9b3c-0ce3efcc5fe2` progressed from pending to complete (refunds, 2 pages, 67 records) in read-only observations; no execution timestamp or watermark is exposed. Last success, current coverage, mappings/exclusions, errors and freshness remain unresolved. Provider OAuth/ingestion/scheduling code and four read-only reporting scopes remain unchanged; the Sales route only gained early reference-array validation.

Only database assignment/257 MB usage is exposed. No current SQL engine/collation/schema/ledger or backup inventory is available through searched connector operations. The owner/manual action is exact: select this site's assigned database in authenticated hPanel phpMyAdmin, run the provided read-only metadata SQL, inspect actual ledger/definitions and save results privately. Then compare C/D proposals, assign the next genuinely unused number and prepare exact preflight/apply/postflight commands. **Migration remains unnumbered, and staging deployment is blocked until schema is known.**

Current private backup and restoration are not verified. A concrete encrypted export and isolated restore procedure is prepared, with actual private paths/credentials/engine and private-data authorization deliberately required before execution. No private export/restore or hosted backup mutation occurred. The current source backup and synthetic restoration are not database recovery evidence. [Database/restore gate](PRESTAGING_DATABASE_AND_RESTORE_2026-11-08.md).

## Release decision and evidence

The archive contains B website/footer/SEO/dashboard, C Kitchen, D1 ordering/status/QR/notifications, D2 boundaries and this hardening, while all new operational/payment/email/test capabilities stay OFF. No GA4/GTM, Workspace/DNS or unapproved privacy publication. Device/email/Sandbox/refund/tunnel testing stays deferred until staging is established.

The [30-step release plan](PRESTAGING_RELEASE_PLAN_2026-11-08.md) covers exact approval, current-state/schema/backup gates, optional separately approved migration, archive upload/build, environment preservation, API/visual acceptance, reporting checks and rollback. The prior rollback archive's 143 files and SHA `50ee0015f226649ddfa2342d506d212e694e56c8c425369381690ec710dc8260` were verified. Never revert data or drop additive tables as an application rollback; later paid commitments require a compatibility-aware containment plan.

Repository documentation, the existing PUNA Google reference and the established Pacific Core source/evidence backup are updated. Final Drive revision/readback/DOCSYNC preservation, Git bundle verification, new manifest hashes and all prior 27/37/57/43-entry B/C/D1/D2 manifests are recorded in the execution receipt. Nothing was deployed, merged, pushed or migrated; no provider/email/DNS/Workspace action occurred. **Stop and wait for explicit STAGING DEPLOYMENT APPROVAL after the open gates are resolved.**
