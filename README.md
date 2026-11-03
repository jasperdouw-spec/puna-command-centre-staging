# Unified Puna staging application

The unified application is deployed at https://staging.punaempanadas.ca. The current application release is `6d7b46ec943c1fc8a1895c41c2a3c29fdf93a3ae`, deployed on 3 November 2026 UTC, on Node 22. Hostinger displayed `2026-11-02 20:26` for completed build `01a19f70-3fc0-7006-a1b1-4170b8807683`; successful read-only hosted smoke checks followed. This application-only staging release is complete; separate schema, dependency and recovery work remains as described below. A review-branch update does not itself deploy anything. Git auto-deployment is unset and main is not the deployment source.

The public website and owner/worker workspaces share one authentication system and the isolated staging database. Public design assets and the approved trailer photograph are preserved.

- `/`: public staging catalogue, approved website copy and food-truck-only pickup at Canadian Princess, Ucluelet. Staging is not a public launch.
- `/sign-in`: existing password sign-in. Owners enter `/workspace`; workers are redirected to `/food-truck` on the server. Hosted worker acceptance remains pending.
- Owners use sidebar navigation for product/content editors, source-tracked catalogue records, orders, customer history, operations, recipes/costing and audit views. Permissions are enforced by the server, not by hiding buttons.
- Menu includes the owner import review screen. It uses `POST /api/records`, retains source mappings, rejects conflicting owner edits and creates private drafts. Price confirmation is independent of ingredients/allergens, stock, tax, deposit and packing verification. Publication is a separate action that changes only the staging menu.
- Five empanadas are published in the staging catalogue at CAD 8.00 each: Roasted Eggplant, Ají Chicken, Carne, Ham & Cheese and Puna Strüdl (canonical Apple mapping). Only their prices are owner-confirmed. Chimichurri and four distinct Sanpellegrino variants remain private drafts with dated historical-price provenance and unconfirmed current operational details.
- Unknown stock is not a counted zero. No opening balances were invented. Frozen stock is internal; customer pickup is at the food truck only.
- Product, content, import and operations mutations retain transactional audit history and version conflict checks.

Checkout, legacy test ordering and bootstrap remain disabled on hosting. Square Sandbox and production credentials, Google OAuth credentials and transactional email are not configured. Square access is awaiting private access to the existing merchant account after a reported verification lockout. Google identity linking is implemented and synthetically tested, but has not been configured or provider-tested. Existing password access remains available.

The commerce schema migration was separately approved and applied to the isolated staging database. Startup and deployment never apply migration SQL automatically. Inspect schema and migration history before any separately approved migration; never blindly reset or rerun SQL.

## Deployed sidebar CRM

The current release replaces circular owner navigation with Today, Orders, Customers, Menu, Kitchen and Website, plus Team & settings. Its palette is cream, ivory, charcoal, golden amber and muted olive. Existing operations, reports, recipes, stock, access controls and audit views remain available through grouped sections. Product and website editors retain version conflicts, explicit product confirmation and private website drafts. The Story heading is editable and its default is now “Andean roots. / West Coast life.” Legacy workspace links remain supported.

Customer history is derived from existing paid pickup order records, with real and sandbox records kept separate. Private customer notes remain unavailable: the separate additive `db/007_customer_notes.sql` migration has not been applied. It requires hosted schema inspection, a verified private backup and exact migration approval. Customer history works without that table; no startup or deploy applies migration SQL automatically.

This was an application-only deployment to the existing staging site. Its isolated database and eight existing environment keys were preserved; no migration or seed ran. Legacy test ordering remains disabled, with no bootstrap or provider credentials added. This release does not authorize schema changes, payment activation or a public launch. Future deployments still require current Hostinger configuration, exact approvals and hosted verification.

## Verification

The exact deployed `6d7b46ec943c1fc8a1895c41c2a3c29fdf93a3ae` candidate passed build, typecheck, 12 domain checks and 79 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/41569061868). Its deployment archive SHA-256 is `17376948d7e98814bcccc94b9e4e5776340bbf29a70124ff2872ee90fc4f8158`. These results apply to that exact commit, not later review-branch candidates.

Hostinger completed the current deployment with Next.js 16.3.4, Node 22, build command `npm run build`, output `.next` and root `.` unchanged. Read-only hosted smoke checks verified:

- The public homepage renders “Andean roots.” and “West Coast life.” `/api/puna` returns five products, `storyHeading` exactly `"Andean roots.\nWest Coast life."` and `testOrdersEnabled: false`. `/api/checkout` reports disabled mode with null application and location IDs.
- An existing owner session opens Today, Menu, Website and Customers correctly. `/api/workspace` reports live scope, zero orders and disabled checkout; `/api/customers` reports live scope, zero customers and `notesAvailable: false`. The Website editor preview shows the new heading; no draft was saved or content published.
- The sidebar and Menu render at 971×787. At 390×844, Today → navigation → Menu and the product Edit dialog work without horizontal overflow. The dialog was closed without edits and the viewport restored.

These hosted checks made no data writes and created no test accounts or orders; no provider was activated and no migration ran. For this release, anonymous/staff denial checks remain CI-backed: an external anonymous web probe was unavailable, and no new hosted role-denial result is claimed.

The previous 21 October release, `c6a70fcbcf9968255175d19e21735d634b3240e7`, passed 12 domain and 67 integration/browser/recovery checks in [GitHub Actions](https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/39695648829); its archive SHA-256 was `a03350168661b0854162d8401910f9f1003b4674dc9114fe9dad5719e7f52bf5`. Its hosted acceptance verified HTTPS, public pages/assets, database connectivity, existing-owner sign-in, Orbital/Classic navigation, product editor access, source-tracked import (10 inserted; none overwritten), five explicit staging publications, shared catalogue persistence, logout and unauthenticated owner-route/API denial. A temporary description edit was verified and restored with both audit entries retained. Those checks do not substitute for acceptance of the current sidebar release. The delayed sign-in transition remains a usability follow-up.

Use `npm ci`. Runtime dependencies are pinned by the lockfile: Next 16.3.4, React 19.2.6 and Node >=22.13.0. Integration checks run on a standard GitHub-hosted Linux runner with disposable MariaDB, synthetic accounts/data and bounded job time. The workflow builds a fresh extraction of the deployment archive and tests the running application. Artifacts contain source/build evidence or synthetic screenshots only.

The current Hostinger build reported four npm vulnerabilities (three high, one critical); the previous 21 October build reported three (two high, one critical). `package.json` and `package-lock.json` are identical between those releases, so this UI release did not change declared or locked dependencies. The counts alone do not identify the changed advisory. No automatic package upgrade was applied; dependency remediation needs a separately tested candidate and release approval. An initial source inspection found no ImageResponse/next-og, remote image allowlist, cache-component or Draft Mode usage; this is not a complete vulnerability assessment.

Synthetic provider and recovery checks do not prove real Square/Google access, hosted worker fulfilment, actual payment capture or recovery of the preserved private website backups. Magenta's private restore rehearsal remains blocked. No hosted worker accounts, orders, stock movements or payment transactions were created in catalogue acceptance. Stock counts, ingredients/allergens, operational capacity, schedules, tax/deposit/portion rules, provider setup and hosted end-to-end order testing need separate verification and approval. Public tax wording is not evidence that tax rules have been verified.

Keep private backups, production credentials, customer records and session tokens out of this public repository and its Actions artifacts. No production launch, migration, cleanup, provider activation or hosted release is authorized merely by a documentation or review-branch update. See `INTEGRATION.md` for the original integration boundary; use this README's deployed-release statement for current release status.
