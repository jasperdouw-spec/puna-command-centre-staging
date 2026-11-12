# Pre-staging database inspection and private restore gate

**Blocked, not performed.** The connector identifies the database assigned to `staging.punaempanadas.ca` and its 257 MB usage, but exposes no SQL executor, current migration ledger, engine/version/collation or backup inventory. A root listing exposes only `.htaccess`, not the private Node build tree. No existing database or backup was modified. The historical November 4 export is not current pre-migration evidence.

## Exact owner/manual read required

1. In authenticated hPanel, select **staging.punaempanadas.ca → Databases → phpMyAdmin**, then the assigned `u291146170_puna_stage` database. Verify the database name, not merely the site's tab label. An already-approved SSH session with private database access is an alternative. Do not enable remote SQL access, reset a password or publish an inspection endpoint to obtain this evidence.
2. Run `db/inspection/prestaging-readonly.sql`. Save results privately. Execute its generated SHOW CREATE statements and inspect the ledger's actual columns before `SELECT * FROM schema_migrations`. Capture views, check constraints, trigger/routine/event definitions separately in the private export. Export **structure only** through phpMyAdmin if needed; no data dump belongs in chat/Git/Drive.
3. Capture exact counts using the generated COUNT queries. `information_schema.TABLE_ROWS` is not an exact count. Preserve counts and ordered private digests for users, sessions, products, website settings/drafts, audit history, inventory/commitments, existing pickup orders/lines, payments/refunds/provider events, historical sales, reporting facts/mappings/runs and migration ledger. Determine the actual protected table set from inspected schema, not a guessed list.
4. Store the inspection under the established private PUNA evidence area, e.g. `/Volumes/PacificData/Projects/puna-foods/documentation/private/prestaging-<UTC timestamp>/`, directory mode 0700/files 0600 on encrypted storage. This is a **proposed private destination**, not a newly created backup. Share only sanitized schema conclusions/count comparisons with the release record. Do not copy credential columns or customer values into repository artifacts.

## Migration decision

`db/proposals/phase_c_live_kitchen.sql` and `db/proposals/phase_d1_ordering.sql` remain **unnumbered and unapplied**. C introduces six kitchen tables. D1 introduces seven extension/simulation/outbox tables and changes existing `pickup_orders.batch_id`, `pickup_order_lines.inventory_stage`, and kitchen allocation columns. D1 is not a CREATE-only migration; its ALTER clauses need exact engine/collation/index/foreign-key comparison and lock-duration rehearsal. Fake-provider/capture tables are not authorization to enable fake providers on hosting.

After inspection, compare every target name/column/default/nullability/enum/index/constraint and all referenced key types/collations. Verify existing order/inventory records, partial candidate tables, orphan rows and ledger checksums. Then assign the next unused migration ID, produce a final checksum-bound file and extend the reviewed preflight runner. The current `scripts/migrate.mjs` allowlist accepts only 006/007/008; **do not pass the proposal to it or invent 009**. There is no valid C/D apply command yet. The release is blocked until this is resolved, even though the first application review keeps Kitchen/ordering off.

The future migration package must name the exact file/number/SHA, database identity, approved preflight and apply commands, expected before/after definitions/counts, lock window, and a verified current restore. It must fail on any collision or partial ledger/schema mismatch. No startup/build performs migration. Approval of the application archive does not authorize SQL.

## Current backup procedure — prepared only

Hostinger documents database downloads in hPanel's Backups area and direct SQL exports over SSH. Its backup UI may offer dated automatic snapshots; verify the actual date, database and scope in this account before treating one as current. Prefer a fresh consistent logical dump for the migration window. [Hostinger backup downloads](https://www.hostinger.com/support/5981435-how-to-download-backups-at-hostinger/), [SSH export](https://www.hostinger.com/support/4536328-how-to-export-a-database-over-ssh-in-hostinger/).

An operator must first verify the current server/client family and supported options. For an inspected MariaDB database with transactional tables, the command shape is:

```sh
# FUTURE APPROVED PRIVATE SESSION ONLY. Paths/SSH alias/recipient file must be
# verified with the owner first; no passwords in arguments or shell history.
set -euo pipefail
umask 077
PUNA_BACKUP_DIR='/Volumes/PacificData/Projects/puna-foods/documentation/private/prestaging-YYYYMMDDTHHMMSSZ'
mkdir -m 700 "$PUNA_BACKUP_DIR"
ssh puna-staging-private 'mariadb-dump --defaults-extra-file=/PRIVATE/approved-puna-client.cnf --single-transaction --quick --hex-blob --routines --events --triggers --skip-lock-tables --default-character-set=utf8mb4 u291146170_puna_stage' |
  gzip -c | age -R /PRIVATE/approved-backup-recipients.txt > "$PUNA_BACKUP_DIR/database.sql.gz.age"
shasum -a 256 "$PUNA_BACKUP_DIR/database.sql.gz.age" > "$PUNA_BACKUP_DIR/SHA256SUMS"
shasum -a 256 -c "$PUNA_BACKUP_DIR/SHA256SUMS"
```

`/PRIVATE/...`, the SSH alias and timestamp above are deliberately unresolved private inputs, not executable approvals. The credential file must already be approved, outside the web root and mode 0600; the encryption identity stays separately in the owner's private store. If the host supplies `mysqldump` instead, verify its family/version/options and substitute only after review. Never write an unencrypted dump to public_html. If piping/export/encryption fails, mark the artifact incomplete; do not label it a backup. Record tool versions, start/end UTC, encrypted file bytes/SHA and a decrypt/decompress integrity check. No backup command was executed in this phase.

`--single-transaction` gives a consistent snapshot for transactional data, not for nontransactional tables or concurrent DDL. Check engines; agree a no-DDL window. If exact across-time protected-row comparisons require pausing staff writes/reporting, obtain a separate short maintenance approval. Do not silently stop cron. Capture before/after private baselines and timestamps; explain legitimate reporting movement rather than forcing matching counts. Derive the restored snapshot's counts/digests from that same dump. [MariaDB dump behavior](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump).

## Isolated restoration rehearsal — separate approval required

1. Confirm owner authorization to decrypt and restore **current private data**, the private destination, encryption key and retention. Existing approval covers synthetic databases only; no private restoration was attempted here.
2. Create a new explicitly labelled isolated container/VM with the **inspected** server version, charset/collation and required disk capacity. Bind no public port; disable network egress and database event scheduler. Mount no existing operational volume and never point the app at hosting. Keep payments, reporting jobs, mail and all fixture/operational flags off; preferably restore without starting the application.
3. Verify encrypted SHA, decrypt/decompress through a pipe into the isolated SQL client with a private 0600 credential file. Use the matching MariaDB/MySQL client; do not strip unknown SQL errors or retry partial imports as if successful. Inspect routine/event DEFINER portability and privileges without silently dropping them. No `CREATE DATABASE`/`USE` in a dump may escape the isolated server.
4. Compare table/view counts, exact row counts, SHOW CREATE definitions, columns, engines, charset/collation, indexes, foreign keys, triggers/routines/events and ledger checksums. Compare privately computed ordered row digests for the agreed protected records. Verify referential integrity/orphans and enum/null distributions. The snapshot must be internally consistent; do not compare it to a later changing live report as if the times matched.
5. Rehearse the final approved migration **only on that restored copy** after a separate migration-rehearsal authorization; compare all protected baselines again. Record duration, lock behavior, capacity and error-free postflight. No current exact migration exists yet.
6. Keep only approved encrypted artifacts and sanitized pass/fail/digest evidence; preserve the untouched original backup. Remove only the labelled rehearsal resources according to the approved retention decision.

A successful export is not a verified restore. The 59-table disposable synthetic recovery validates application test mechanics only. Current private backup, restore and final hosted migration compatibility all remain open release gates.
