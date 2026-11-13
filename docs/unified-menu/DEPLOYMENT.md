# Unified menu deployment and rollback

Scope is staging.punaempanadas.ca only. The official website, payment activation and automatic POS deductions are outside this release.

## Verified build lineage

Dedicated branch `codex/unified-menu-20261112`; draft PR https://github.com/jasperdouw-spec/puna-command-centre-staging/pull/4 . Original root checkout remains unchanged.

Final application source: local commit `4a7f143ba9e373b3dc2b62860c0873fbb76c2693`; GitHub commit `4f46c5d37cb9b45e851f0cd932d9a0c382dd6607`; identical tree `d5b93fd5d2f267f05ccf87007814f665641cc4c5`. Different commit metadata does not change source bytes.

Archive `test-artifacts/unified-menu/release-final-4a7f143/puna-unified-4a7f143-20261112.zip`: 270 committed files, SHA-256 `746e2bb97fddf67b2af19e9eeddcb4af7f98350dfbdb64abc4f4adf7a3eab836`. Reopened, CRC checked and every entry compared byte-for-byte with git HEAD. No local credentials, dependencies, build outputs or business records are included. The documentation checkpoint is recorded separately after deployment.

Hostinger configuration: manual archive upload, Next.js preset, Node 22.x, npm, `npm run build`, root `./`, output `.next`. The inherited WASM compiler fallback is required by the hosting runtime and was exercised in CI. Do not change Git auto-deployment or another domain.

## Feature gates retained

| Setting | Hosted value |
|---|---|
| PUNA_LIVE_KITCHEN_ENABLED | true |
| PUNA_KITCHEN_PUBLIC_PREVIEW | true |
| PUNA_KITCHEN_FIXTURES | false |
| PUNA_ORDERING_LOCAL_ENABLED | false |
| PUNA_ORDERING_ACCEPT_NEW | false |
| PUNA_SQUARE_POS_ENABLED | false |
| STAGING_TEST_ORDERS_ENABLED | false |

Hosted customer checkout is unavailable. The tested checkout/provider simulator is intentionally local/disposable only. Publishing this menu does not authorize real reservations or payments.

## Migration and data preservation

Target database verified as `u291146170_puna_stage`. Existing 006 and 009 prerequisite checksums matched. Neither extension table existed. Migration 010 added only `kitchen_service`, `kitchen_pickup_schedule` and its checksum ledger entry. Schema checksum: `fb4a133c3b7b6196ef725cd0643ae5c83b89702977a83fefd1772055920b3b37`.

Post-migration readback: one unreviewed service row, null session/review deadlines, policy 480/10/15/6/60; zero pickup schedules; one matching migration checksum. Existing table checksums match before and after:

| Table | Checksum |
|---|---:|
| kitchen_state | 256349050 |
| kitchen_lots | 3524193142 |
| kitchen_allocations | 0 |
| kitchen_allocation_lines | 0 |
| kitchen_events | 15690133 |

Retained snapshot: state version 32; seven lots; 15 ready units; 11 baking units; zero active allocations; 31 kitchen events. The old mode is Open, but it has no verified new session and therefore cannot publish trusted availability. An actual staff review and Open action are required; no stock review or opening attestation was fabricated during deployment.

Fresh pre-migration export: `test-artifacts/unified-menu/backups/puna-kitchen-pre-unified-20261112.sql`, 20,403 bytes, SHA-256 `91b29e903526eb729e90e0e55218801126861e245d3ec8bfa8f11481b5da7f99`. Contains six selected kitchen tables and a completed transaction, with structure and data; read back and verified. It is private evidence, not committed source or ordinary documentation. Existing full Hostinger native backup is dated 11 November 23:37; a newer manual full backup was unavailable under the 24-hour cooldown. The fresh kitchen export does not claim to be a complete business database backup.

## Rollback

1. Keep all checkout/POS/simulator gates disabled.
2. Redeploy the retained previous source archive `test-artifacts/kitchen-ux/final-release/puna-kitchen-ux-c73940f-20261112.zip`, SHA-256 `c74972a125bc96f294848068ef2ed4b083cd3ae40095f2f24a33575a0beeddf7`.
3. Retain both additive tables and all current inventory, allocations, orders and events. Do not drop tables or restore an old database over new activity. The old application ignores the extension and returns to its previous heartbeat/review policy.
4. Read public and authenticated APIs; confirm counts/history and disabled checkout. Record rollback time and exact package.

Disposable integration verifies rollback preservation and a synthetic database restore. A restore of private hosted business data was not exercised. Final hosted release time, API/UI acceptance and evidence receipts are in RELEASE-REPORT.md and BACKUP-VERIFICATION.md.
