# Unified Puna staging application

The unified application is deployed at https://staging.punaempanadas.ca from exact commit `85bed7c71c6e5157abb9ba278ac5acc135c7a12d`, Hostinger build `01a1bf32-8255-71fc-bc48-c41726b5bf48`, completed 9 November 2026 at 07:27:09 UTC. The native MariaDB backup and isolated restore passed, including preservation and enforcement of all nine CHECK constraints. This was an application-only staging release: the 45-table schema and ledger 006 + 008 remain unchanged, while Kitchen, ordering, payments, email and fixtures remain off. Node 22, Next 16.4.1, manual ZIP deployment, private environment values and the existing reporting cron are preserved. Git auto-deployment is unset and linked repositories are empty. See the [verified staging release record](docs/STAGING_RELEASE_2026-11-09.md) for recovery, acceptance, reporting limits and rollback identity.

The historical release and local-phase checkpoints below remain as dated evidence. Their earlier open recovery/deployment gates are superseded only by the 9 November staging release record. The exact candidate branch/archive was not changed; this documentation lives on a separate child branch.

The public website and owner/worker workspaces share one authentication system and the isolated staging database. Public design assets and the approved trailer photograph are preserved.

- `/`: public staging catalogue, approved website copy and food-truck-only pickup at Canadian Princess, Ucluelet. Staging is not a public launch.
- `/sign-in`: existing password sign-in. Owners enter `/workspace`; workers are redirected to `/food-truck` on the server. Hosted worker acceptance remains pending.
- Owners use sidebar navigation for product/content editors, source-tracked catalogue records, orders, customer history, operations, recipes/costing and audit views. Permissions are enforced by the server, not by hiding buttons.
- Menu includes the owner import review screen. It uses `POST /api/records`, retains source mappings, rejects conflicting owner edits and creates private drafts. Price confirmation is independent of ingredients/allergens, stock, tax, deposit and packing verification. Publication is a separate action that changes only the staging menu.
- Five empanadas are published in the staging catalogue at CAD 8.00 each: Roasted Eggplant, Ají Chicken, Carne, Ham & Cheese and Puna Strüdl (canonical Apple mapping). Only their prices are owner-confirmed. Chimichurri and four distinct Sanpellegrino variants remain private drafts with dated historical-price provenance and unconfirmed current operational details.
- Unknown stock is not a counted zero. No opening balances were invented. Frozen stock is internal; customer pickup is at the food truck only.
- Product, content, import and operations mutations retain transactional audit history and version conflict checks.

Checkout, legacy test ordering and bootstrap remain disabled on hosting. Square payment credentials, Google OAuth credentials and transactional email are not configured. Production Square reporting uses a separate, verified server OAuth connection with four read-only scopes; desktop MCP authorization remains separate. Google identity linking is implemented and synthetically tested, but has not been configured or provider-tested. Existing password access remains available.

The commerce schema migration was separately approved and applied to the isolated staging database. Startup and deployment never apply migration SQL automatically. Inspect schema and migration history before any separately approved migration; never blindly reset or rerun SQL.

## Deployed reporting and source references

The review branch implements owner-only Square item CSV previews and transactional imports, full-row duplicate detection before privacy projection, versioned product mappings, read-only production OAuth, resumable Orders/Refunds ingestion, and explicit CSV/API source reconciliation. Daily/monthly and product/category/location views share the same included item ledger. Separate Reporting API snapshots use metadata-verified measures and never enter item totals. Source recipes and operating references retain dated versions, formulas and verification issues without changing catalogue, stock or production rules.

The approved additive `db/008_reporting.sql` migration and real-data imports are applied. Included item totals match the independent private source scan and Item Sales aggregate; repeated imports add no duplicate facts. Existing accounts, catalogue and original audit history were verified unchanged. Owner Sales reports and source Recipes views show the imported evidence. Exact source counts, financial reconciliation, protected-record checksums and private backup manifests remain outside this public repository.

The historical originals are still required for exact CSV-baseline reconciliation. Unresolved source mappings and unverified recipe units/yields/costs remain visible. Recipes are source evidence until operational inputs are confirmed; no stock or production facts were invented. See [REPORTING.md](REPORTING.md) for metric limits, private authorization, checkpoint recovery and deployment order.

## Deployed sidebar CRM

The current release replaces circular owner navigation with Today, Orders, Customers, Menu, Kitchen and Website, plus Team & settings. Its palette is cream, ivory, charcoal, golden amber and muted olive. Existing operations, reports, recipes, stock, access controls and audit views remain available through grouped sections. Product and website editors retain version conflicts, explicit product confirmation and private website drafts. The Story heading is editable and its default is now “Andean roots. / West Coast life.” Legacy workspace links remain supported.

Customer history is derived from existing paid pickup order records, with real and sandbox records kept separate. Private customer notes remain unavailable: the separate additive `db/007_customer_notes.sql` migration has not been applied. It requires hosted schema inspection, a verified private backup and exact migration approval. Customer history works without that table; no startup or deploy applies migration SQL automatically.

The 3 November sidebar release was an application-only deployment to the existing staging site. Its isolated database and eight existing environment keys were preserved; no migration or seed ran. Legacy test ordering remains disabled, with no bootstrap or provider credentials added. This release does not authorize schema changes, payment activation or a public launch. Future deployments still require current Hostinger configuration, exact approvals and hosted verification.

## Verification

The current reporting release passed typecheck/build, 21 domain checks and 97 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/41806892412), using disposable MariaDB 11.8.9 and the hosted `utf8mb4_unicode_ci` collation. Archive SHA-256: `50ee0015f226649ddfa2342d506d212e694e56c8c425369381690ec710dc8260`. Hosted verification covered authenticated reports/references, bounded history completion, repeat imports, the refresh watermark, protected records, anonymous reporting denial and disabled checkout. The first automatic five-minute job completed on 4 November 2026 UTC. Live-source evidence stays private.

The following evidence describes the preceding sidebar release.

The preceding `6d7b46ec943c1fc8a1895c41c2a3c29fdf93a3ae` candidate passed build, typecheck, 12 domain checks and 79 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/41569061868). Its deployment archive SHA-256 is `17376948d7e98814bcccc94b9e4e5776340bbf29a70124ff2872ee90fc4f8158`. These results apply to that exact commit, not later review-branch candidates.

Hostinger completed that sidebar deployment with Next.js 16.3.4, Node 22, build command `npm run build`, output `.next` and root `.` unchanged. Read-only hosted smoke checks verified:

- The public homepage renders “Andean roots.” and “West Coast life.” `/api/puna` returns five products, `storyHeading` exactly `"Andean roots.\nWest Coast life."` and `testOrdersEnabled: false`. `/api/checkout` reports disabled mode with null application and location IDs.
- An existing owner session opens Today, Menu, Website and Customers correctly. `/api/workspace` reports live scope, zero orders and disabled checkout; `/api/customers` reports live scope, zero customers and `notesAvailable: false`. The Website editor preview shows the new heading; no draft was saved or content published.
- The sidebar and Menu render at 971×787. At 390×844, Today → navigation → Menu and the product Edit dialog work without horizontal overflow. The dialog was closed without edits and the viewport restored.

These hosted checks made no data writes and created no test accounts or orders; no provider was activated and no migration ran. For this release, anonymous/staff denial checks remain CI-backed: an external anonymous web probe was unavailable, and no new hosted role-denial result is claimed.

The previous 21 October release, `c6a70fcbcf9968255175d19e21735d634b3240e7`, passed 12 domain and 67 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/39695648829); its archive SHA-256 was `a03350168661b0854162d8401910f9f1003b4674dc9114fe9dad5719e7f52bf5`. Its hosted acceptance verified HTTPS, public pages/assets, database connectivity, existing-owner sign-in, Orbital/Classic navigation, product editor access, source-tracked import (10 inserted; none overwritten), five explicit staging publications, shared catalogue persistence, logout and unauthenticated owner-route/API denial. A temporary description edit was verified and restored with both audit entries retained. Those checks do not substitute for acceptance of the current sidebar release. The delayed sign-in transition remains a usability follow-up.

Use `npm ci`. Runtime dependencies are pinned by the lockfile: Next 16.3.4, React 19.2.6 and Node >=22.13.0. Integration checks run on a standard GitHub-hosted Linux runner with disposable MariaDB, synthetic accounts/data and bounded job time. The workflow builds a fresh extraction of the deployment archive and tests the running application. Artifacts contain source/build evidence or synthetic screenshots only.

The November 3 Hostinger build reported four npm vulnerabilities (three high, one critical); the previous 21 October build reported three (two high, one critical). `package.json` and `package-lock.json` are identical between those releases, so this UI release did not change declared or locked dependencies. The counts alone do not identify the changed advisory. No automatic package upgrade was applied; dependency remediation needs a separately tested candidate and release approval. An initial source inspection found no ImageResponse/next-og, remote image allowlist, cache-component or Draft Mode usage; this is not a complete vulnerability assessment.

Synthetic provider and recovery checks do not prove real Square/Google access, hosted worker fulfilment, actual payment capture or recovery of the preserved private website backups. Magenta's private restore rehearsal remains blocked. No hosted worker accounts, orders, stock movements or payment transactions were created in catalogue acceptance. Stock counts, ingredients/allergens, operational capacity, schedules, tax/deposit/portion rules, payment-provider setup and hosted end-to-end order testing need separate verification and approval. Public tax wording is not evidence that tax rules have been verified.

Keep private backups, production credentials, customer records and session tokens out of this public repository and its Actions artifacts. No production launch, migration, cleanup, provider activation or hosted release is authorized merely by a documentation or review-branch update. See `INTEGRATION.md` for the original integration boundary; use this README's deployed-release statement for current release status.


## Local Phase B checkpoint — 8 November 2026

Public footer/metadata/404 refinements and the owner Day/Week/Month sales dashboard are preserved at `09db737324ae35d64ffe8857c607aef955e0e6aa` on `codex/puna-phase-b-20261108`. They are not deployed or merged. See [the implementation checkpoint](docs/PHASE_B_CHECKPOINT_2026-11-08.md), [Google Workspace preparation](docs/GOOGLE_WORKSPACE_PREPARATION_2026-11-08.md), [unpublished privacy/analytics draft](docs/PRIVACY_ANALYTICS_DRAFT_2026-11-08.md) and [separate dependency proposal](docs/DEPENDENCY_REMEDIATION_PROPOSAL_2026-11-08.md). Current hosting access/freshness cannot be inferred from earlier release evidence above.

## Local Phase C checkpoint — 8 November 2026

The owner approved local Live Kitchen implementation on the child branch `codex/puna-phase-c-20261108`. The worker screen, physical ready/baking ledger, protected online/truck allocations, explicit counter workflow and read-only public availability are disabled by default. Online reservations/payment transitions are guarded synthetic fixtures; the existing checkout and legacy fulfilment path remain unchanged. See [the Phase C checkpoint](docs/PHASE_C_CHECKPOINT_2026-11-08.md), [approved operating design](docs/LIVE_KITCHEN_APPROVED_PHASE_C_2026-11-08.md), [synthetic demonstration](docs/PHASE_C_DEMONSTRATION_2026-11-08.md) and [provisional schema/rollback](docs/PHASE_C_SCHEMA_AND_ROLLBACK_2026-11-08.md).

No push, merge, deployment or existing-database migration occurred. Phase D, hosted acceptance and activation need separate approval. At that Phase C checkpoint, these items awaited Hostinger reauthentication. The Phase D1 read-only inspection below supersedes that access limitation; security remediation remains separate and open.

## Local Phase D1 checkpoint — 8 November 2026

Local customer ordering extends Phase C on `codex/puna-phase-d-20261108`, parent `8bd5f2b54ef7797be52e9c3dccfbe971f38dfb34`. Ready/started-baking baskets use atomic five-minute holds, durable fake payment reconciliation, private status/QR, staff set-aside/packing, explicit scan/handover and a local email outbox. All new routes require disposable-local gates; defaults remain off. No real payment or email, hosted migration, push, merge or deployment occurred.

Hostinger MCP now authenticates. The current build remains the November 4 manual archive; site Git auto-deploy is null and linked repositories are empty. Reporting output is visible but lacks a completed watermark/time; schema/ledger/current backup and hosted browser acceptance remain unverified. See [read-only findings](docs/PHASE_D1_HOSTINGER_READONLY_2026-11-08.md).

See [D1 checkpoint](docs/PHASE_D1_CHECKPOINT_2026-11-08.md), [architecture](docs/PHASE_D1_IMPLEMENTATION_DESIGN_2026-11-08.md), [demonstrations](docs/PHASE_D1_DEMONSTRATION_2026-11-08.md), [schema/containment](docs/PHASE_D1_SCHEMA_AND_CONTAINMENT_2026-11-08.md) and [D2 approval package](docs/PHASE_D2_APPROVAL_PACKAGE_2026-11-08.md). Containment stops intake while preserving existing obligations. D2 providers/devices, operational validation and dependency remediation are separate approvals.

## Phase D2 backend preparation — 8 November 2026

The owner deferred device and email acceptance until staging is complete and asked to use the private backend for now. Local preparation continues on `codex/puna-phase-d2-20261108`, from exact D1 `113ac14e642ee0f2714844c6ab622c8648a6c510`. Hosted configuration is unchanged. The production reporting connection cannot supply Sandbox payments. No external payment, refund, callback, email or physical-device test has run.

Added tested Sandbox identity/payment/recipient guards and a default-off, standalone callback-only relay candidate. These helpers are not connected to the D1 application adapter. All 171 inherited integration checks, 41 domain checks and 17 new boundary checks pass, with no QR screenshots saved in D2. Build/typecheck pass. No public tunnel, push, merge or deployment occurred; dependencies and unnumbered schema proposals remain unchanged.

Read-only hosting inspection now shows a completed cron output, but no execution timestamp or watermark; current reporting freshness/completeness remains unverified. See [D2 checkpoint and release gates](docs/PHASE_D2_BACKEND_CHECKPOINT_2026-11-08.md), [security/provider prerequisites](docs/PHASE_D2_EXPOSURE_AND_PROVIDER_GATES_2026-11-08.md) and the [12-minute José/worker walkthrough](docs/PUNA_TRUCK_ACCEPTANCE_CHECKLIST.md). This checkpoint completes local preparation, not external D2 acceptance or staging readiness.

## Pre-staging hardening — 8 November 2026

Local child branch `codex/puna-prestaging-20261108` preserves exact D2 and patches Next 16.3.4 → 16.4.1, sharp 0.35.4 → 0.35.5 and source-map-js 1.2.1 → 1.2.2. React stays 19.2.6 and Zod stays 3.25.76. All 17 application collection schemas now reject excessive arrays before element validation and enforce a nested-input budget; the Zod package advisory remains reported. Build generation is bounded to one worker. See [security decisions](docs/PRESTAGING_SECURITY_2026-11-08.md).

The exact proposed archive, final commit, checksums and actual validation results are in the external pre-staging release manifest/receipt. This candidate contains B/C/D1/D2 but keeps Kitchen, ordering, payment/email adapters and fixtures off. Hosted schema/ledger, current private backup/restore, hosted acceptance and explicit deployment approval remain gates. **No deployment is authorized or performed.** Use the [complete release/acceptance/rollback plan](docs/PRESTAGING_RELEASE_PLAN_2026-11-08.md) and [private database procedure](docs/PRESTAGING_DATABASE_AND_RESTORE_2026-11-08.md). Source/evidence backups are not database backups.
