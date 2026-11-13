# Unified menu documentation and backup receipt

Verified 12 November 2026 Pacific / 13 November UTC. Prior checkpoints and the original root checkout were preserved.

## Pacific Core

Project checkout: `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory`.

- Documentation: `docs/unified-menu`.
- Actual hosted and synthetic acceptance images: `test-artifacts/unified-menu/screenshots`.
- Final source: `test-artifacts/unified-menu/release-final-4a7f143/puna-unified-4a7f143-20261112.zip`; 270 files verified against committed source; SHA-256 `746e2bb97fddf67b2af19e9eeddcb4af7f98350dfbdb64abc4f4adf7a3eab836`.
- Evidence archive: `test-artifacts/unified-menu/backups/puna-unified-menu-20261112-evidence.zip`; **7,728,311 bytes**; SHA-256 `21b5d4fd98f1a836b14f88899dd241c5a36d2d0fbd88e7e5d584fe70340f9471`; MD5 `64e812d672362c21f668db5f610998ed`.
- Evidence manifest: `test-artifacts/unified-menu/backups/EVIDENCE-MANIFEST.json`.
- Fresh pre-migration kitchen SQL: `test-artifacts/unified-menu/backups/puna-kitchen-pre-unified-20261112.sql`; **20,403 bytes**; SHA-256 `91b29e903526eb729e90e0e55218801126861e245d3ec8bfa8f11481b5da7f99`. File permissions 0600; private evidence rather than committed documentation. No credentials or authentication tables included.

The evidence ZIP was reopened, passed CRC verification and all **24 evidence entries** matched their recorded SHA-256 values. Its embedded source archive's 270 files were independently compared with git HEAD. The sealed evidence archive includes report, architecture, deployment, tablet checklist, CI evidence, visual checks, final screenshots, source and kitchen snapshot. This receipt and the later project-reference mirror are retained alongside it to avoid a self-referential archive hash.

## Established Drive destinations

| Record | Verified destination |
|---|---|
| Release report | https://drive.google.com/file/d/1TDM2m4LfjvYHwrubSK4rUxz8JCSwNOya/view |
| Architecture | https://drive.google.com/file/d/1p__72Vqp-_EtARX50ZlX5Yy0Xd80mvvX/view |
| Deployment and rollback | https://drive.google.com/file/d/151QJ3XvG8y5Vo0FyU5RbRrqNs3P6JRMS/view |
| Evidence manifest | https://drive.google.com/file/d/19j80Dmme2ZS7HP4C5fra-hWebxJNvuB9/view |
| Evidence backup | https://drive.google.com/file/d/1uUHedGVODCoiJQIoqFjfr6OVFfxMVJjO/view |
| Tablet acceptance | https://drive.google.com/file/d/1so8dZ-4Kv-WT8slIioE1QDpZ42QmF5eY/view |

Website files are in the existing Documentation folder `11j4AaRxTnL0okaAGmuhYEj6v3wfoMv7F`. Tablet acceptance is in the requested Tablet Project folder `1jsxbcrbHu5z_v3VcLVL-zVHsKtHMPUYP`, using the PUNA Google identity. No sharing permissions were changed.

Report, architecture, deployment, tablet checklist and manifest were downloaded through the Drive connector and compared **byte-for-byte** with local files. Drive confirmed the evidence ZIP's exact 7,728,311-byte size and expected parent folder, and produced a complete file reference. A remote ZIP hash was **not independently verified**: inline-byte transport closed, and the local environment could not download the file reference. Do not interpret matching metadata as a remote cryptographic verification. The local ZIP and its contents are verified, and its manifest was read back exactly from Drive.

## Operational reference and limits

The established native document is https://docs.google.com/document/d/1B3NroHjK1YnBHgYWu6CBe5900X1xPoKfEqN78XBC9z8/edit . The completion addendum, preserved-prefix readback and local plain-text mirror are recorded in the separate reference verification record.

This backup does not claim a fresh full-business-database backup or a private hosted restore test. The retained Hostinger native backup is dated 11 November 23:37; a fresh full manual backup was blocked by its 24-hour cooldown. The selected kitchen export and unchanged-table checksums were verified before/after migration and final deployment. No prior records were deleted or replaced.
