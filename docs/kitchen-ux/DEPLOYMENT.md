# Staging deployment and rollback

Target: **staging.punaempanadas.ca only**. Existing Hostinger Business Web Hosting, manually uploaded Next.js application, Node 22.x, `npm run build`, `.next` output and standalone publishing. Existing staging database: `u291146170_puna_stage`. No database migrations or data-reset commands are part of this release.

Prior hosted release verified: `puna-inventory-20cc815-20261112.zip`, build `01a1d08d-0efe-731a-b7af-e1d18ca81de1`, Completed / Current. Its local rollback archive is `test-artifacts/final-release/puna-inventory-20cc815-20261112.zip`; SHA-256 `3be36324f96e552284d5d75824c41833413c84aa02a66fd30a757c5ad47cae9b` was verified again.

The native Hostinger files/database backup from November 11, 23:37 Pacific remains available. A new manual backup was unavailable at inspection because of Hostinger's 24-hour cooldown (next eligible November 12, 23:37 Pacific). No fresh private-database restore is claimed. The application-only update preserves all later stock events.

Authenticated read-only predeployment ledger check: version 25, five lots, 14 physically recorded ready units, zero baking, no reservations, 24 audit events. Website allocation 13, counter allocation one. This includes four sauce units. No new opening-stock attestation was made; actual physical accuracy is unknown. Stored mode was Open, effective status Paused due to expiry. Compare these records after deployment; do not restore an earlier database over them.

Verified hosted configuration before deployment:

| Switch | Value |
|---|---|
| PUNA_LIVE_KITCHEN_ENABLED | true |
| PUNA_KITCHEN_PUBLIC_PREVIEW | true |
| PUNA_KITCHEN_FIXTURES | false |
| PUNA_ORDERING_LOCAL_ENABLED | false |
| PUNA_ORDERING_ACCEPT_NEW | false |
| PUNA_SQUARE_POS_ENABLED | false |
| PUNA_CHECKOUT_MODE | disabled |

No environment values are changed by this update. Real credentials are excluded from these documents and source archives.

Candidate packaging uses committed tracked files only, deterministic ZIP entries and a per-file SHA-256 manifest. Local and GitHub complete source trees must match before testing/deployment. The successful CI run and final archive hash are recorded in REPORT.md.

After deployment, verify the Hostinger completed/current status; inspect public availability and disabled checkout; reload the authenticated kitchen and reporting pages; compare the saved ledger; inspect responsive views and console errors. Do not press Connect or Open without a real truck stock review. Staff-to-customer transactional acceptance uses the disposable test database.

Rollback: redeploy the retained previous source ZIP using the existing environment and database. Verify the old application and saved ledger. This changes application files only; there is no reverse schema migration. Do not activate live payments, automatic Square POS or the official website as part of rollback or acceptance.
