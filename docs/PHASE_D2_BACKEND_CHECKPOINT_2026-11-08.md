# Phase D2 backend preparation — external acceptance deferred

This is a backend preparation checkpoint, **not completed Square/email/device acceptance**. The owner subsequently instructed: do not arrange devices yet; no approved email recipients/accounts yet; finish staging first; use the private backend for now. That instruction supersedes immediate Track A/C setup. The existing website backend has production **read-only reporting**, which cannot be repurposed for Sandbox charges. Work therefore stayed local with simulated providers. No private hosted backend was modified.

Branch `codex/puna-phase-d2-20261108`, worktree `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-phase-d2`, parent D1 `113ac14e642ee0f2714844c6ab622c8648a6c510`. Final commit/clean state are in the external receipt. Original/review, B, C and D1 worktrees and backups are preserved. No local main ref exists; no remote branch was modified. No push, merge, deployment, existing-database migration, tunnel, provider account, email, payment, refund, DNS change or Workspace purchase occurred.

## Reverification and local work

D1 was clean at its expected commit. Kitchen/order/fixture flags remain false in `.env.example`. The new standalone relay flag also defaults false. Production reporting code/scopes are unchanged: `MERCHANT_PROFILE_READ`, `ORDERS_READ`, `PAYMENTS_READ`, `REPORTING_READ`; the desktop connection remains separate and was not used for payments. Hosted environment names match D1; masked values and current remote OAuth grants could not be independently reread. No credential was copied from production.

`scripts/d2/guards.mjs` prepares exact Sandbox application/merchant/location/CAD/scope and payment-result checks, Square signature verification and an exact single-recipient allowlist. Empty recipient lists deny. These are tested boundary helpers, **not a connected provider adapter or external sender**. The current application still uses its D1 local adapter. A real adapter, durable provider binding, reconciliation consumer and refund orchestration must be integrated and tested when a separate Sandbox account is available. No configured provider IDs or credentials exist in these artifacts.

`scripts/d2/callback-relay.mjs` is a dependency-free, separate-process callback candidate. It accepts only the exact Square callback POST, verifies the signature over the registered HTTPS URL and raw body, checks the configured merchant/location, bounds bodies/headers/connections/time/rate/session duration and durably stores minimized event-routing metadata with duplicate protection. It has no Next.js dependency, application route, database connection, arbitrary forwarding, provider call or payment/stock mutation. Configuration must be private, owner-only and outside the repository; the CLI binds only 127.0.0.1:3901 and creates no tunnel. The module is not called by build/startup. Its acceptance response means durable queueing only, never payment success.

No internet relay was opened. A future private consumer must independently retrieve provider state, verify identities/amounts/currency, atomically apply existing order invariants and mark event processing durably. A queue receipt is not provider reconciliation. Email callbacks are not implemented in this Square-only relay. See [exposure and provider boundaries](PHASE_D2_EXPOSURE_AND_PROVIDER_GATES_2026-11-08.md).

## Exact validation counts

On verified project-local Node 22.23.4:

```sh
export PATH="$PWD/work/runtime/node-v22.23.4-darwin-arm64/bin:$PATH"
npm ci --no-audit --no-fund
npm run build
npm run typecheck
node --test tests/d2-boundaries.mjs
PUNA_LOCAL_DOMAIN_TESTS=true node tests/domain.mjs
PUNA_LOCAL_DOMAIN_TESTS=true node tests/sales-domain.mjs
node tests/sales-dashboard-domain.mjs
node tests/kitchen-domain.mjs
node tests/run-local-disposable.mjs
git diff --check
```

- **17 D2 local boundary checks pass**: wrong environment/identity/scopes/amount/currency/reference/result; empty/foreign/wildcard/malformed recipients; bounded private relay configuration; route/method/content/body/signature rejection; minimized durable events; simultaneous duplicates; changed-payload conflicts; delayed/out-of-order queueing; restart/provider-retry simulation; no proxy routing.
- **171 inherited integration/browser/recovery checks pass**, including non-loopback fixture refusal, original order behavior, uncertain payment/restart, QR race/manual/offline handling and notification dedupe/retry. Providers and camera remain simulated.
- **41 domain checks pass**: commerce/costing 12, sales 9, dashboard/calendar 11, kitchen 9.
- Typecheck, webpack production build and whitespace checks pass. Recovery compares **59 tables / 183 index entries / 68 foreign-key entries**, definitions and counts, in a disposable synthetic restore. The owned database was removed.
- D2 regression capture is disabled: **zero PNGs** were generated. No raw status/QR credentials, frames or external provider payloads were copied to evidence. D1's already-approved screenshots remain in its untouched backup.

No final local test failed. Review hardened private-path checks against misleading `..` prefixes. A GitHub workflow-collection API read was unsupported; the supported contents API succeeded. Current remote workflow bytes differed from the inherited local integration file, so both remote files were read rather than assuming equality: they contain build/test/artifact steps, no deployment. These read limitations are not provider acceptance results.

## Track matrix

| Track | Actual result | Remaining input/work |
| --- | --- | --- |
| A iPhone/Safari | Not run; no named device/operator/version | Owner deferred until staging complete |
| A Android/Chrome | Not run; no named device/operator/version | Same |
| A truck tablet | Not run; no approved device/browser/version | Same; native BarcodeDetector cannot be assumed |
| A fallback | Existing authenticated exact order/email manual recovery re-tested locally | Physical camera denial/revocation, low light/angles/distance, offline and two-device race still untested |
| B Square Sandbox | **0 external payments, 0 external refunds, 0 real provider callbacks** | Separate Canadian Sandbox application/seller/location/scoped credential; private configuration and real adapter/consumer integration |
| B local provider behavior | Existing A–I synthetic scenarios pass | Simulated HTTP/timeouts/signatures are not Square acceptance |
| B refunds | Not authorized separately and not run | Explicit bounded Sandbox refund approval; once-only financial state with separately decided stock disposition |
| C email | **0 external messages; no provider/account activated; allowlist empty** | Owner deferred recipients/account and inbox testing |
| C inbox rendering | No desktop/mobile inbox evidence | D1 local capture is not delivery; provider “delivered” events alone are insufficient |

## Hosting/reporting/database read-only findings

Hostinger MCP still authenticates. Build `01a1a5df-b752-723f-92df-d1b0c939f330`, archive `puna-reporting-d1ba527-20261104.zip`, configured Node major 22 and build Next 16.3.4 remain. Site Git auto-deployment is null and linked repositories are empty. Current remote review-branch workflows were read: main/PR build checks and review-branch synthetic integration, no deployment steps. Repository/organization webhooks and other external automation remain outside the audit. Local branch activity caused no remote change.

Hosted checkout returns disabled; public responses remain noindex/nofollow; legacy test orders are false. Anonymous Sales returns 401, read-only GET to the job endpoint returns 405, and the local fixture path returns 404. No job was invoked. D1's separate browser 403 challenge remains historical evidence; physical/hosted browser acceptance was not repeated here.

| Reporting dimension | Observed evidence |
| --- | --- |
| Cron exists | `*/5 * * * *`, same private-command job |
| Latest observable output | Run `dabdc72d-0bc8-486e-b905-25d7312be16b`, state **complete**, phase refunds, 2 pages, 67 records; observed 9 November UTC |
| Execution timestamp | Not supplied in output |
| Watermark | Not visible |
| Complete date/location coverage | Unverified |
| Unresolved mappings / exceptions | Unverified through anonymous/read-only access |
| Current health | Completed-run output is stronger evidence than D1's pending output, but is insufficient for a freshness/completeness claim |

Database assignment/size metadata is visible (257 MB); no SQL/schema/migration-ledger operation was found. Installed engine/collation/constraints and an unused migration number remain unverified. Proposals remain unnumbered and hosted compatibility provisional. Current backup inventory/private restore remains unverified. Source bundles and synthetic restores do not establish either.

## Staging and release gates

1. **Staging review with ordering disabled:** separate reviewed dependency remediation and exact deploy approval; current backup/rollback evidence and Linux packaging/hosted smoke checks. Preserve reporting, noindex and existing settings. This can precede the owner-deferred device/email tests. No SQL is applied unless separately approved after actual schema/ledger inspection. D1's disposable-only ordering gates cannot simply be enabled on hosting.
2. **Staging ordering validation:** integrate a separately gated Sandbox adapter, secure test environment/credentials, private durable job runner and callback consumer; approved recipients and device session when the owner is ready; actual payment/refund/webhook/inbox/device evidence. Do not reuse production reporting access.
3. **Production ordering:** all above plus José/worker acceptance, confirmed hours/holding/windows, tax/price/product readiness, refund/late pickup authority, privacy/retention/processor choices, verified private restore and explicit production activation/deployment approval.
4. **Google Workspace:** owner approves tenant/domain ownership, budget/admins/mailbox/reply routing and DNS plan separately. No purchase or new admin/hola/orders addresses yet. Transactional delivery is a separate application service.
5. **Atlas handoff:** hand over the clean commit, verified source/evidence bundle, accurate deferred-test matrix, schema/security/reporting gaps and exact next authorization. Do not label D2 externally accepted or launch-ready, change Atlas automation, or transfer secrets in chat/artifacts.

Repository/Drive/backup readback and hashes are recorded in the D2 execution receipt. Existing B/C/D1 evidence remains intact. The [12-minute José/worker checklist](PUNA_TRUCK_ACCEPTANCE_CHECKLIST.md) is prepared for later use; no walkthrough was scheduled or claimed complete.
