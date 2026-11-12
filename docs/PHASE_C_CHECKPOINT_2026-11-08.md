# Phase C local implementation checkpoint

Scope: the owner's approved local Live Kitchen implementation and synthetic tests. Phase D implementation, hosted changes, real providers and Google activation remain separately gated. The date is 8 November in Vancouver; execution evidence also uses 9 November UTC.

## Source and preserved work

Branch `codex/puna-phase-c-20261108`, worktree `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-phase-c`, child of verified Phase B `09db737324ae35d64ffe8857c607aef955e0e6aa`. The original checkout remains clean at `b20f516f9a79b6a98a5c2ffd9e262d1501aa975a`; Phase B remains clean and unchanged. The final Phase C commit is recorded in the execution receipt and Drive checkpoint, avoiding a self-referential commit hash in source.

No push, merge, deployment, hosted restart or existing-database migration occurred. The project-local verified Node 22.23.4 and unchanged lockfile were used; system/hosted runtimes were untouched. No new CI workflow or deployment trigger was added. Feature flags default to false.

## Implemented and demonstrated

- Simple worker product/quantity controls, 20/25/30-minute server estimates, persistent countdowns, explicit partial readiness, delay, waste and manager count corrections.
- One physical ready/baking ledger divided into online/truck allocations. Original batch size is shown separately; readiness moves units between stages. Atomic transfers move free capacity only.
- All-or-nothing synthetic online holds with a configurable five-minute default, protected pending/uncertain/paid states, explicit late-success exceptions and actual-batch pickup commitments.
- Quick ready-stock counter reservation, explicit Square-payment/physical-handover acknowledgement, and confirmed-unpaid cancellation. Paid online ready portions have an explicit physical set-aside confirmation.
- Open/Paused/Closed; server heartbeat and physical-review expiry; optimistic stock versions; audited idempotent mutations; reconnect requires a recent authoritative observation and leaves the kitchen paused.
- Synthetic pickup queue and optional read-only public availability, with estimates, confirmation time and cached-data expiry. Existing public artwork/layout, detailed inventory, legacy orders and checkout paths are preserved.

The [approved design](LIVE_KITCHEN_APPROVED_PHASE_C_2026-11-08.md) is authoritative for five-minute holds, allocation/queue rules, minimum counter steps, stock provenance, freshness and remaining operational decisions. The [demonstration](PHASE_C_DEMONSTRATION_2026-11-08.md) maps the tested sequence to screenshots.

## Exact validation

All commands ran in the Phase C worktree using local Node 22.23.4:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run build
PUNA_LOCAL_DOMAIN_TESTS=true node tests/domain.mjs
PUNA_LOCAL_DOMAIN_TESTS=true node tests/sales-domain.mjs
node tests/sales-dashboard-domain.mjs
node tests/kitchen-domain.mjs
node tests/run-local-disposable.mjs
git diff --check
```

Typecheck, production webpack build and whitespace validation pass. Domain checks: 12 commerce/costing, 9 sales, 11 dashboard/calendar and 9 kitchen invariants, **41 total**. Disposable integration suite: **132 checks pass**, including the existing 102 Phase B checks, 21 new kitchen API/concurrency checks, 7 worker/public browser checks and feature-off checks before/after the candidate schema.

Coverage includes concurrent channel allocation and transfers, no negative free stock, held/paid protection, all-or-nothing baskets, actual-batch partial readiness, waste deficits, delayed commitments, server-time expiry, protected payment uncertainty, five-minute owner policy, stale API versus truck, expired physical review despite a fresh heartbeat, observation/version conflicts, heartbeat takeover, role/origin denial, auditing, once-only consumption, late payment, disabled-default schema independence and legacy ledger fingerprints. The browser demonstrates offline action blocking/no replay, explicit reconnect to Paused and public stale messaging.

Synthetic recovery compares **52 tables, 154 index entries and 58 foreign-key entries**, including definitions and row counts. This is a disposable synthetic restore, not restoration of a private historical export or a current hosted backup.

Browser widths: 1440 desktop, 390 mobile and 320 narrow; worker and public panels have no horizontal overflow. Reviewed captures include partial readiness, channel transfer, counter reservation, public live/stale availability and paused reconnection. Captures use local system Chrome, reduced motion and disabled GPU to avoid local compositor artifacts. They are not hosted screenshots or formal accessibility certification.

Exploratory failures were corrected before final acceptance: scoped worker styling fixed inherited dark-background contrast; explicit select labels fixed ambiguous browser selectors; browser waits exclude Next's empty route announcer and wait for the refreshed stale state before asserting. Screenshot review also corrected an offline screen retaining its previous Open badge and made the connection warning explicit. Counter labels now use Vancouver time. An overlapping test launch failed the occupied-port guard; the final suite ran alone against a newly created labelled tmpfs database. Failed captures/logs are excluded from the accepted backup evidence.

Not run: Phase C GitHub/Linux packaged deployment acceptance; hosted schema/migration rehearsal; hosted visual/worker acceptance; live Square payment or POS events; real notification delivery; Phase D QR/customer tests; current private backup restore; real truck walkthrough. Functional tests are not security clearance.

## Schema and rollback

`db/proposals/phase_c_live_kitchen.sql` proposes six additive InnoDB tables. It is deliberately unnumbered; hosted compatibility remains provisional. Existing migrations 001–008 and the normal runner are untouched. Only `tests/apply-kitchen-schema.mjs` applied it, after verifying ownership and identity of the new local disposable database. No operational stock was seeded from history.

Rollback first pauses new allocations and resolves/drains protected obligations. Disabling the three flags restores the original screens and blocks new kitchen actions while retaining tables and commitments. It does not erase, fulfil or migrate orders. Dropping tables or restoring private data needs a separate approved recovery plan. See [schema and rollback](PHASE_C_SCHEMA_AND_ROLLBACK_2026-11-08.md).

## Open blockers and owner action

Hostinger is configured but unavailable in this session because OAuth requires reauthentication. Exact owner action: in Terminal on this Mac, run `codex mcp login hostinger`, complete the browser sign-in to the existing Hostinger account, then return for read-only verification. Do not add scopes or change runtime settings. No credential repair was attempted here.

Current hosted reporting health/coverage, deployment triggers, schema/migration ledger and hosted acceptance remain unverified. The saved November 4 refresh is historical evidence, neither today's health nor proof that the job stopped. No reporting job, scope or credential changed. Therefore feature branches remain local.

Dependency remediation is separate: current registry review still reports 14 advisory records across four installed packages. Maintainer advisories verify the Next 16.4.1 / sharp 0.35.5 candidate minimums; source-map-js and Zod primary-advisory verification limitations remain documented. Zod 3→4 requires breaking-change approval. No package/lockfile update occurred. See the [separate proposal](DEPENDENCY_REMEDIATION_PROPOSAL_2026-11-08.md).

Google Workspace remains preparation-only under the existing proposal. No purchase, tenant, account, DNS, service activation, administrator grant or unrelated-system change occurred.

## Documentation and source backup

The repository contains the approved addendum, this checkpoint, demonstration, schema/rollback and updated README/DEVELOPMENT/REPORTING notes. The existing PUNA Foods — Complete Project & Operations Reference Google Doc receives a manual Phase C append outside its managed DOCSYNC block, with exact content/revision readback.

Established destination: `/Volumes/PacificData/Projects/puna-foods/documentation/backups/puna-phase-c-<commit12>`. The source Git bundle, current documents, reviewed synthetic screenshots and passing test/evidence logs are copied there, read back and SHA-256 verified. The final execution receipt is `/Volumes/PacificData/Projects/puna-foods/documentation/phase-c-20261108-execution-receipt.json`; it records the actual commit, Drive revision, manifest and verification results. Historical Phase B backup contents remain intact.

This is a source/documentation backup. Private historical SQL exports were not restored or relabelled current. Existing documentation automation was not changed; manual Drive success does not repair or certify automated synchronization.

## Staff acceptance and next approval

Before online sales: validate the three counter steps during busy service, who owns the visible truck tablet, paid-item labels/physical separation, the 90-second heartbeat and 15-minute stock-review intervals, shift handover, offline contingency, manager correction/waste authority, and the boundary between frozen stock, oven loads and legacy obligations. No assumption that staff will reliably perform an extra Square acknowledgement has been accepted as operational fact.

Remaining Phase D: design-approved customer checkout against this ledger; provider-authoritative payments and reconciliation; duplicate/out-of-order events; late-success/refund resolution; approved pickup windows; packing/ready notifications; secure status links and QR scan-to-inspect plus explicit atomic handover/manual recovery. Use synthetic data and separately authorized sandbox providers only after Phase D approval. Sandbox credentials/services, email activation, existing-database changes and hosted release retain their individual gates. STOP after this Phase C checkpoint.
