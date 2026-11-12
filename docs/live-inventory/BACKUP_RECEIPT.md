# PUNA inventory release backup receipt — November 12, 2026

## Authoritative release and local locations

- Tested/deployed source: local `20cc815770a15e45a4be8f8acf2ee5304af86e7e`; remote `b4455e064f00cae997ad3ea755a1b952aa3f99e4`; exact matching Git tree `00a2d937ea4cc669575fa13c5e814613990dea78`.
- Feature branch: https://github.com/jasperdouw-spec/puna-command-centre-staging/tree/codex/live-inventory-20261111 . Later documentation-only commits preserve the tested application files.
- Source/docs: `/Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory` (original checkout preserved).
- Evidence archive: `test-artifacts/backups/puna-live-inventory-20261112/PUNA_Live_Inventory_Evidence_2026-11-12.zip`, 9,032,476 bytes, SHA-256 `773deddd42578d55c9a16a6312996ed73ac4be8fcae05f7ab5345e9c65ca6178`.
- Deployed source archive: `test-artifacts/final-release/puna-inventory-20cc815-20261112.zip`, 5,000,996 bytes, SHA-256 `3be36324f96e552284d5d75824c41833413c84aa02a66fd30a757c5ad47cae9b`.

## Established Google Drive locations

| Item | Verified location |
|---|---|
| Website/Command Centre folder | https://drive.google.com/drive/folders/11j4AaRxTnL0okaAGmuhYEj6v3wfoMv7F |
| Existing main project reference, release appended | https://docs.google.com/document/d/1B3NroHjK1YnBHgYWu6CBe5900X1xPoKfEqN78XBC9z8/edit |
| Consolidated report | https://drive.google.com/file/d/1LQZCCy0I7hmo7XwEMKhLgz5z20VmEJZt/view |
| Source, docs, screenshots and validation evidence ZIP | https://drive.google.com/file/d/1vq7iv7qRKVeQK3oQYqb2lyzylH8jZJUO/view |
| Exact file manifest | https://drive.google.com/file/d/1JLKWLF_tsTVv5CFYRFOwk4RMMm_V8JCQ/view |
| Existing tablet folder | https://drive.google.com/drive/folders/1jsxbcrbHu5z_v3VcLVL-zVHsKtHMPUYP |
| Tablet handoff | https://drive.google.com/file/d/1mlBojnWiO5qpcGyhZbAXSdyPHdPRmLY2/view |

## Readback and recovery evidence

The local evidence ZIP was extracted into a temporary directory: all 23 enclosed file SHA-256 values matched the manifest. The nested source archive passed CRC verification and contains the expected 244 source files. The deployed source archive was separately checked against its per-file manifest before upload. Baseline and comparison screenshots match the successful CI run 43256538548; sample counts/products are synthetic.

Drive report and manifest contents were read back and matched local text exactly. Remote archive parent folder and byte length matched. The remote binary ZIP was not independently downloaded for byte-hash verification; do not describe that as a remote-byte restore test. Tablet handoff text matched exactly and its parent folder was verified.

The main project reference was appended using its revision guard. Readback verified the existing 162,558-character document prefix was preserved (apart from the final insertion newline) and the full new release block is present. The matching local append is `PROJECT_REFERENCE_APPEND.txt`. The evidence ZIP predates this receipt and append; these two files are separately committed with the final documentation and this receipt is saved beside the evidence in Drive.

Hostinger's native files-and-databases backup completed at 2026-11-11 23:37 Pacific. Creation was verified in its UI. A fresh restore of that private backup was not executed. The disposable synthetic database restore passed separately: 63 tables, 192 indexes and 71 foreign keys. No private database, credentials or real inventory counts are included in the ordinary evidence archive.

## Release boundary

Staging application and additive migration 009 are installed. Kitchen/public-preview flags are enabled, the kitchen is closed, and checkout, automatic POS and fixtures are off. Authenticated hosted staff acceptance, physical Lenovo and opening count, Square mappings/provider acceptance and reconciliation, current private-data recovery and the production launch decision remain outstanding. No DNS, official-site cutover or live payment activation occurred.
