# Unified Puna staging application

The unified application is deployed at https://staging.punaempanadas.ca. The deployed release is `f695a1454cf52f7c6446aef293ae068ae09c1d81` (21 October 2026), on Node 22. The review branch may contain newer changes; a branch update does not deploy them. Git auto-deployment is unset and main is not the deployment source.

The public website and owner/worker workspaces share one authentication system and the isolated staging database. Public design assets and the approved trailer photograph are preserved.

- `/`: public staging catalogue, approved website copy and food-truck-only pickup at Canadian Princess, Ucluelet. Staging is not a public launch.
- `/sign-in`: existing password sign-in. Owners enter `/workspace`; workers are redirected to `/food-truck` on the server.
- Owners can use Classic or Orbital navigation, product/content editors, source-tracked catalogue records, operations, recipes/costing and audit views. Permissions are enforced by the server, not by hiding buttons.
- Catalogue import uses `POST /api/records`, retains source mappings, rejects conflicting owner edits and creates private drafts. Price confirmation is independent of ingredients/allergens, stock, tax, deposit and packing verification. Explicit publication changes only the staging menu.
- The review branch adds an owner import review screen under Website → Products → Edit. It is a pending release correction; the currently deployed f695a14 release exposes the import API but has no import button.
- Unknown stock is not a counted zero. No opening balances are invented. Frozen stock is internal; customer pickup is at the food truck only.
- Product, content, import and operations mutations retain transactional audit history and version conflict checks.

Checkout, legacy test ordering and bootstrap remain disabled on hosting. Square Sandbox and production credentials, Google OAuth credentials and transactional email are not configured. Square access is awaiting private account access recovery. Google identity linking is implemented and synthetically tested, but has not been provider-tested. Existing password access remains available.

The commerce schema migration was separately approved and applied to the isolated staging database. Startup and deployment never apply migration SQL automatically. Inspect schema and migration history before any separately approved migration; never blindly reset or rerun SQL.

## Verification

The deployed f695a14 candidate passed 12 domain checks and 65 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/39683838802). Those results apply to that exact commit. Hosted checks verified HTTPS, public pages/assets, database connectivity and anonymous access denial. Subsequent authenticated checks confirmed the existing owner's sign-in, navigation and view preference persistence. Catalogue population and its reversible edit acceptance remain pending the import-screen correction.

Use `npm ci`. Runtime dependencies are pinned by the lockfile: Next 16.3.4, React 19.2.6 and Node >=22.13.0. Integration checks run on a standard GitHub-hosted Linux runner with disposable MariaDB, synthetic accounts/data and bounded job time. The workflow builds a fresh extraction of the deployment archive and tests the running application. Artifacts contain source/build evidence or synthetic screenshots only.

Synthetic provider and recovery checks do not prove real Square/Google access, hosted worker fulfilment, actual payment capture or recovery of the preserved private website backups. Magenta's private restore rehearsal remains blocked. Stock counts, operational capacity, schedules, tax/deposit/portion rules, provider setup and hosted end-to-end order testing need separate verification and approval.

Keep private backups, production credentials, customer records and session tokens out of this public repository and its Actions artifacts. No production launch, migration, cleanup, provider activation or hosted release is authorized merely by a documentation or review-branch update. See `INTEGRATION.md` for the original integration boundary; use this README's deployed-release statement for current release status.
