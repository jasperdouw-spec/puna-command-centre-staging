# Live inventory staging deployment and recovery

This runbook is for `staging.punaempanadas.ca`, not the official public launch. Refer to VALIDATION.md for what was actually executed.

## Prerequisites

- Preserve the current Hostinger deployment archive and create a native files-and-databases backup. A backup confirmation does not establish that a new private-data restore was tested.
- Verify database identity `u291146170_puna_stage`, MariaDB 11.8.9, existing migration checksums 006/008, InnoDB parent tables, `users.id` unsigned BIGINT and `products.id` varchar(64)/utf8mb4_unicode_ci.
- Check for partial or colliding `kitchen_*` tables. Do not import seeds or replace any existing business table.
- Require a passing disposable integration run for the exact application changes. Review screenshots and unchanged approved assets.

## Additive kitchen schema

The supported runner is `node scripts/migrate.mjs --migration=009_live_inventory` for a plan. It checks parent types, previous checksums, collisions and the migration ledger. Apply with the existing secure database environment, `PUNA_SCHEMA_APPROVAL=009_live_inventory`, and `--apply`. The script must never run at application startup or build. Do not put database credentials in command history, documentation, archives or GitHub.

Migration 009 creates six empty kitchen tables and one closed kitchen-state row. It imports no product, stock, customer, sale or order. It does not alter existing tables. Its SHA-256 is `ada479c9899aaae66e04c7a34b864d1d76f15831a733dfd30a6985d62aa6940f`.

If using authenticated phpMyAdmin instead, explicitly select the verified staging database, execute the reviewed file, and record that same checksum in `schema_migrations` only after all statements succeed. MariaDB DDL auto-commits: a partial error requires inspection; do not stamp a failed migration or blindly retry. Verify all six definitions and constraints, one closed state row and no lots, allocations or events. Existing business records must remain intact.

The Phase D1 and POS schemas remain separate proposals. They must not be applied to hosting as part of the staff-only kitchen release.

## Application and feature gates

Package committed source with `python3 scripts/package-source.py test-artifacts/release`. Verify every archived file against the manifest. Hostinger uses manually uploaded source, Next.js, Node 22, npm, root `./`, `npm run build`, output `.next`. Retain all existing environment settings and secrets.

| Variable | Kitchen staging | Reason |
|---|---|---|
| PUNA_LIVE_KITCHEN_ENABLED | true after 009 verification | Staff ledger interface |
| PUNA_KITCHEN_PUBLIC_PREVIEW | true only for the approved staging preview | Read-only cabinet |
| PUNA_KITCHEN_FIXTURES | false/unset | No synthetic writes on hosting |
| PUNA_ORDERING_LOCAL_ENABLED | false/unset | Loopback simulation only |
| PUNA_ORDERING_ACCEPT_NEW | false/unset | No customer intake |
| PUNA_SQUARE_POS_ENABLED | false/unset | Mappings/provider acceptance pending |
| PUNA_CHECKOUT_MODE | disabled/unset | No hosted payment activation |
| STAGING_TEST_ORDERS_ENABLED | false | Preserve existing closed checkout |

After deployment, check public page and mobile layout, existing Story/navigation, cabinet closed/unconfirmed state, `/api/checkout` disabled, staff authentication and role restrictions. Do not open the kitchen or invent initial stock. An authorized worker must physically count food before opening. Do not test on hosted business data with fixture transactions.

## Recovery

Rehearsed synthetic recovery includes native database dump/restore, schema/index/FK/count comparison, idempotent migration rerun, missing-table detection, and feature-off preservation of paid commitments.

For an application regression, pause intake; preserve and reconcile holds/paid pickups; turn new feature flags off and redeploy the prior verified application archive. Retain kitchen tables and audit history. Never drop inventory tables or restore an older database over newer business transactions as an application rollback. A database restore is a separate recovery decision with a defined recovery point.

## Production release gate

Complete real Square catalog/location mapping, Sandbox payment and refund acceptance, missed-event reconciliation and operator issue resolution, physical Lenovo acceptance, staff training and counted stock, current private-data recovery verification and hosted security/visual acceptance. Production payments and official-site cutover require a later explicit launch decision.
