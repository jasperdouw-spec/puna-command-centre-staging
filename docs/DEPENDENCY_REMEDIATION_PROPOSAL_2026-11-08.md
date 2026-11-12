# Dependency review — separate remediation proposal

Read-only npm registry bulk advisory lookup on 9 November 2026 UTC found 14 advisory records affecting four installed packages. This is an advisory count, not npm audit's transitive vulnerability count and not a confirmed exploit count. Package manifests and lockfile are unchanged in Phase B. No audit fix or dependency upgrade was run.

| Package / installed version | Severity | Advisory | Affected range returned |
| --- | --- | --- | --- |
| next 16.3.4 | high | [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | `>=16.0.0 <16.3.8` |
| next 16.3.4 | critical | [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) | `>=16.2.0 <16.3.6` |
| next 16.3.4 | moderate | [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) | `>=16.0.0 <16.3.8` |
| next 16.3.4 | moderate | [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | `>=16.0.0 <16.3.8` |
| next 16.3.4 | moderate | [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) | `>=16.3.0 <16.3.8` |
| next 16.3.4 | moderate | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) | `>=16.0.0 <16.3.8` |
| next 16.3.4 | low | [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) | `>=16.0.0 <16.3.8` |
| next 16.3.4 | moderate | [GHSA-h694-7cp9-m8p3](https://github.com/advisories/GHSA-h694-7cp9-m8p3) | `>=16.3.0 <16.3.8` |
| next 16.3.4 | high | [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) | `>=16.0.0 <=16.4.0` |
| next 16.3.4 | critical | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) | `>=16.0.0 <=16.4.0` |
| next 16.3.4 | critical | [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | `>=16.0.0 <=16.4.0` |
| sharp 0.35.4 | high | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | `<0.35.5` |
| source-map-js 1.2.1 | high | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `>=1.0.0 <1.2.2` |
| zod 3.25.76 | high | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | `<4.6.6` |

## Targeted candidate, not yet applied

1. First candidate: Next 16.4.1 or a subsequently verified patched 16.x release; verify the exact registry metadata, release notes and all applicable advisory ranges before installation. Ensure the resolved sharp is at least 0.35.5. This is a minor Next update, not merely a patch, and needs compatibility review. The upstream [SVG optimizer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) identifies 16.4.1 and sharp 0.35.5 as remedies and describes glibc Linux exposure. Local macOS success does not prove hosted Linux safety.
2. Resolve source-map-js to at least 1.2.2 through a reviewed lockfile update within compatible parent ranges. Inspect duplicates and the installed dependency tree; avoid a blanket override masking incompatibilities.
3. The registry reports Zod versions below 4.6.6 affected. Moving this project from Zod 3 to 4 is a major upgrade: present the validation/error/API compatibility changes for approval first. The maintainer advisory URL returned 404 during direct verification, so retain this as registry-reported pending primary-source confirmation. Do not assert that all Zod 3 usage is exploitable or that it is safe. Review request-size/collection limits as a separate narrowly tested mitigation if an upgrade cannot proceed.

The current app uses static images and does not import next/image, next/og ImageResponse, use-cache functions, Draft Mode or Server Actions. That narrows some feature-specific exposure; it does not establish that framework endpoints or hosted cache behavior are unreachable. Do not execute attack payloads against hosting.

Create a separate remediation branch/commit after agreeing the candidate. Preserve package/lock provenance, inspect the full dependency diff, verify advisory disappearance, then run typecheck, production build, auth/role/origin checks, disposable DB commerce/reporting/recovery tests and browser screenshots on the pinned Node 22 line. Test production Linux packaging/optimizer behavior and cold/warm caches; repeat provider fixture isolation. Major/breaking changes require approval, and deployment remains separately gated. Keep the prior lockfile/build for rollback; no database migration is part of this dependency change.

This proposal does not remediate the running host. Existing historical build vulnerability counts are not a fresh scan of its installed tree. Host access and a separate tested release are still needed.

## Phase C independent verification — 9 November UTC

Rechecked the four installed versions against the official npm registry advisory endpoint: the same 14 records remain. Candidate-only queries for Next 16.4.1, sharp 0.35.5, source-map-js 1.2.2 and Zod 4.6.6 returned no records for those exact versions, and official registry version metadata exists for each. This is not a clean audit of a resolved replacement dependency tree, compatibility testing or security clearance.

The maintainer's [Next SVG advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [typed-array cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) and [Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) identify 16.4.1 as patched. The [sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) identifies 0.35.5. These are verified candidate minimums for a separate remediation branch, not a deployed-release recommendation.

The [Zod 4.6.6 release](https://github.com/colinhacks/zod/releases/tag/v4.6.6) confirms checking collection size bounds before parsing elements; it also documents release provenance after a repository-history rewrite. Its advisory-specific maintainer URL still returned 404. The source-map-js maintainer advisory URL also returned 404. Retain those primary-advisory verification limits; inspect provenance, release notes and the resolved tree before approving an exact remediation release. Zod 3→4 remains a breaking upgrade requiring approval and validation of error/validation behavior. No manifests, lockfile, system runtime or hosted dependencies were changed by Phase C.

## Phase D1 read-only Hostinger addendum

Authenticated Hostinger inspection on 9 November UTC returned 14 advisory records across the same four package/version pairs. Hostinger assigns different severity labels to some records; the API scan may lag the installed tree and is not a fresh full dependency audit. Its proposed version fields do not supersede the maintainer verification/rehearsal requirements above. D1 changes neither package manifest nor lockfile, applies no upgrade and adds no dependency. Passing commerce/security invariants is not dependency security clearance. Remediation remains a separate candidate and approval.

## Phase D2 exposure review — 9 November UTC

A fresh npm advisory lookup still returns 14 records across the same four installed versions. No implemented remediation branch exists among current local refs. D2 leaves manifests/lockfile unchanged and does not expose the Next application. A standalone callback-only relay candidate imports only Node built-ins and passed 17 local boundary checks; no public listener/tunnel was opened. Runtime/tunnel/private-configuration review and a durable provider consumer remain necessary before any real callback testing.

The [D2 exposure and provider gates](PHASE_D2_EXPOSURE_AND_PROVIDER_GATES_2026-11-08.md) order the work: narrowly isolated callback preparation, separately tested framework/sharp/source-map remediation before staging, and explicit compatibility review for Zod's major upgrade. Zod is not assumed safe to defer for a hosted release merely because the relay does not import it. No advisory is treated as resolved by these feature changes.

## Pre-staging implementation supersedes the proposal

The owner authorized a separate child hardening branch. Current registry/package/maintainer rechecks led to exact Next 16.4.1, transitive sharp 0.35.5 and source-map-js 1.2.2 with no override. The full lock advisory lookup falls from 14 records to one Zod record. Zod remains 3.25.76; reviewed early length and aggregate/depth checks mitigate collection amplification across all 17 application array schemas. This does not remove its upstream advisory. React and runtime major are unchanged; static build workers are bounded to one for the constrained host. The [implemented security note](PRESTAGING_SECURITY_2026-11-08.md) records all version/transitive/compatibility decisions, residual risk and the separate Zod 4 proposal. The final release receipt records actual Linux/full-regression results; no historical or failed run is substituted for acceptance of the final archive.
