# Unified Puna staging application

The unified application is deployed at https://staging.punaempanadas.ca. The deployed release is `c6a70fcbcf9968255175d19e21735d634b3240e7` (21 October 2026, Pacific time), on Node 22. Hostinger reported deployment completed, followed by hosted acceptance checks. The review branch may contain newer documentation; a branch update does not deploy it. Git auto-deployment is unset and main is not the deployment source.

The public website and owner/worker workspaces share one authentication system and the isolated staging database. Public design assets and the approved trailer photograph are preserved.

- `/`: public staging catalogue, approved website copy and food-truck-only pickup at Canadian Princess, Ucluelet. Staging is not a public launch.
- `/sign-in`: existing password sign-in. Owners enter `/workspace`; workers are redirected to `/food-truck` on the server. Hosted worker acceptance remains pending.
- Owners can use Classic or Orbital navigation, product/content editors, source-tracked catalogue records, operations, recipes/costing and audit views. Permissions are enforced by the server, not by hiding buttons.
- Website → Products → Edit includes the deployed owner import review screen. It uses `POST /api/records`, retains source mappings, rejects conflicting owner edits and creates private drafts. Price confirmation is independent of ingredients/allergens, stock, tax, deposit and packing verification. Publication is a separate action that changes only the staging menu.
- Five empanadas are published in the staging catalogue at CAD 8.00 each: Roasted Eggplant, Ají Chicken, Carne, Ham & Cheese and Puna Strüdl (canonical Apple mapping). Only their prices are owner-confirmed. Chimichurri and four distinct Sanpellegrino variants remain private drafts with dated historical-price provenance and unconfirmed current operational details.
- Unknown stock is not a counted zero. No opening balances were invented. Frozen stock is internal; customer pickup is at the food truck only.
- Product, content, import and operations mutations retain transactional audit history and version conflict checks.

Checkout, legacy test ordering and bootstrap remain disabled on hosting. Square Sandbox and production credentials, Google OAuth credentials and transactional email are not configured. Square access is awaiting private access to the existing merchant account after a reported verification lockout. Google identity linking is implemented and synthetically tested, but has not been configured or provider-tested. Existing password access remains available.

The commerce schema migration was separately approved and applied to the isolated staging database. Startup and deployment never apply migration SQL automatically. Inspect schema and migration history before any separately approved migration; never blindly reset or rerun SQL.

## Verification

The exact deployed `c6a70fcbcf9968255175d19e21735d634b3240e7` candidate passed build, typecheck, 12 domain checks and 67 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/39695648829). Its deployment archive SHA-256 is `a03350168661b0854162d8401910f9f1003b4674dc9114fe9dad5719e7f52bf5`. These results apply to that exact commit, not subsequent documentation-only commits.

Hosted acceptance verified HTTPS, public pages/assets, database connectivity, existing-owner sign-in, orbital navigation, Classic/Orbital preference persistence, product editor access, source-tracked import (10 inserted; none overwritten), five explicit staging publications, and shared catalogue persistence after refresh. A clearly labelled temporary description edit was verified in owner and public views, then restored; both audit entries remain. Logout and subsequent unauthenticated owner-route/API denial passed. Sign-in eventually completed but its delayed transition remains a usability follow-up.

Use `npm ci`. Runtime dependencies are pinned by the lockfile: Next 16.3.4, React 19.2.6 and Node >=22.13.0. Integration checks run on a standard GitHub-hosted Linux runner with disposable MariaDB, synthetic accounts/data and bounded job time. The workflow builds a fresh extraction of the deployment archive and tests the running application. Artifacts contain source/build evidence or synthetic screenshots only.

Hostinger reported dependency advisories for Next, sharp and source-map-js. No automatic package upgrade was applied to the approved exact release. Dependency remediation needs a separately tested candidate and release approval. An initial source inspection found no ImageResponse/next-og, remote image allowlist, cache-component or Draft Mode usage; this is not a complete vulnerability assessment.

Synthetic provider and recovery checks do not prove real Square/Google access, hosted worker fulfilment, actual payment capture or recovery of the preserved private website backups. Magenta's private restore rehearsal remains blocked. No hosted worker accounts, orders, stock movements or payment transactions were created in catalogue acceptance. Stock counts, ingredients/allergens, operational capacity, schedules, tax/deposit/portion rules, provider setup and hosted end-to-end order testing need separate verification and approval. Public tax wording is not evidence that tax rules have been verified.

Keep private backups, production credentials, customer records and session tokens out of this public repository and its Actions artifacts. No production launch, migration, cleanup, provider activation or hosted release is authorized merely by a documentation or review-branch update. See `INTEGRATION.md` for the original integration boundary; use this README's deployed-release statement for current release status.
