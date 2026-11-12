# Targeted pre-staging security candidate

The dedicated child branch starts at exact D2 `b6e48ddebb625dc8c0c1adda0322c7abdcb35fc5`. No automatic audit fix, broad framework upgrade, production credential change or hosted remediation was performed. The exact final commit/archive is recorded in the external release manifest to avoid a self-referential archive hash.

| Package | D2 | Candidate | Decision |
| --- | --- | --- | --- |
| Next | 16.3.4 | 16.4.1 | Lowest stable 16.x release outside all currently returned ranges; later 16.4.x releases were not automatically selected |
| sharp | 0.35.4 | 0.35.5 | Compatible Next transitive dependency; updated platform binaries and libvips 1.3.3 → 1.3.4 |
| source-map-js | 1.2.1 | 1.2.2 | Normal PostCSS/Tailwind dependency tree; no override |
| Zod | 3.25.76 | 3.25.76 | No published stable patched 3.x found; early collection checks added, major upgrade deferred |
| React / React DOM | 19.2.6 | 19.2.6 | Unchanged, within Next's published peer range |

The lock changes 39 versioned entries: Next/env/platform SWC, sharp/platform/libvips, source-map-js and sharp's compatible semver 7.8.5 → 7.8.6. No override or new runtime dependency was added. The complete old/new path list, resolved dependency tree, registry metadata/integrities and lock diff are in the evidence bundle. Original lock SHA-256 `163b555e73f2338aac5a96af560a445f3a29f75e2e37046580386a1c68f3db24`; candidate `4baf7a5740feefbd16ebb843aa53415366ccb97604ece31df1b5afb0c7f0c528`.

Fresh registry advisory lookup over **all versioned lock entries** returned 14 records before and **one remaining high-severity Zod record** afterward. Next/sharp/source-map-js returned no applicable records. This is dated registry evidence, not a guarantee against undisclosed vulnerabilities. The installed tree and lock were checked; the hosted tree remains the prior release.

Next's maintainer release explicitly fixes the typed-array cache, SVG optimizer and Server Actions advisories; metadata supports Node >=20.9 and existing React 19. Project runtime remains Node 22.23.4/npm 10.9.9. sharp's compatible release uses patched libvips. [Next 16.4.1](https://github.com/vercel/next.js/releases/tag/v16.4.1), [Next SVG advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [sharp 0.35.5](https://github.com/lovell/sharp/releases/tag/v0.35.5). The prior source-map maintainer-advisory URL could not be independently verified; the current npm advisory range and exact patched package metadata remain the evidence for 1.2.2.

## Zod applicability and mitigation

The risk applies: local tests show Zod 3 `.max()` still visits every supplied element and accumulates failures. Existing request-size limits alone do not prevent error amplification, especially for nested reference grids. No application Set/Map/record schemas were found. All **17 array schemas** now call `boundedArray`, which rejects excessive length **before** invoking element validation. It also bounds each collection subtree to **25,000 visited nodes and depth 16**, preventing multiplicative nested validation even when individual array dimensions are within their old maxima. The traversal is iterative; cyclic inputs terminate at the depth budget. Shared non-cyclic objects remain accepted.

The existing min/max, transformations, duplicate-product rules, ordinary element error paths and public generic error responses remain. A full 500 × 40 reference grid is accepted. A batch whose aggregate structure exceeds the budget must be split into smaller imports; this is an intentional input limit. Over-limit input yields one early issue instead of parsing all elements. These guards also cover parsed stored configurations/reference payloads. Auth, origin checks, existing HTTP body limits and default-off checkout/fixtures remain in place. They do not establish general HTTP flood protection or make an unlimited body reader safe.

Eight targeted tests prove the vulnerable baseline, zero element visits after early refusal, ordinary output/error compatibility, aggregate/depth/cycle bounds, cart/tax behavior, the full supported reference grid and application-wide guard coverage. The complete inherited suite also passes. **The package advisory remains open in scanners.** This is a reviewed application-level mitigation for this candidate, not an upstream Zod patch; release approval must acknowledge that residual finding. No assertion is made that all Zod 3 usage is safe. [Maintainer collection fix](https://github.com/colinhacks/zod/pull/6652), [Zod 4.6.6 release/provenance](https://github.com/colinhacks/zod/releases/tag/v4.6.6).

## Separate Zod 4 compatibility proposal — not implemented

An eventual upgrade must be a separate approved change using an exact then-verified patched 4.x version. The present package remains 3.x. Review these concrete differences against [the maintainer migration guide](https://zod.dev/v4/changelog):

- `app/api/customers/route.ts` has `z.string().regex(...).transform(Number).default('1')`. In v4 defaults short-circuit transforms and must match output type. Use `.prefault('1')` to preserve current parsing behavior (or prove `.default(1)` equivalent); test omitted/valid/invalid page inputs and inferred types.
- Audit `.uuid()`, `.email()`, datetime offsets and integer/safe-number acceptance against real allowed formats and synthetic fixtures. Do not loosen UUID validation to accommodate a failing test without checking the identifier contract.
- Review the helper's generic `ZodTypeAny`, pipeline inference, `ZodIssueCode`, issue metadata and fatal-refinement behavior. Reconfirm early refusal and nested-budget tests under v4; upstream array fixes do not replace aggregate application budgets.
- Verify strict-object errors, defaults and coercion in workspace/customer/product/website schemas. Routes generally return generic errors rather than raw Zod issues, but internal type/error changes still require typecheck and API tests. No `.errors`, `.format()` or `.flatten()` dependency was found in application code.
- Run both versions against a saved compatibility corpus, then all 41 domain, 171 integration and 25 boundary checks, plus the Linux archive acceptance. Review changed accepted/rejected values and HTTP error shapes before approving the major. No production package switch is authorized by this proposal.

## Production compatibility and remaining limits

Webpack remains the build command; static/social assets and private headers are preserved, with no new remote image allowlist or optimizer route exposed. `experimental.cpus=1` now bounds static-generation build workers for the constrained hosting environment; this does not alter request concurrency or feature flags. The app has no `next/image`, ImageResponse, Server Actions or `use cache` imports found by source search. That fact does not waive framework patches. Auth/cache/route behavior is covered by inherited tests and the packaged Linux checks.

Current hosted logs show linux-x64 native SWC cannot load because `GLIBC_2.29` is unavailable, then Next uses WASM. Exact hosted OS/glibc/Node patch are not exposed. The Linux harness uses pinned Node 22.23.4 Debian x64 under local emulation and explicitly validates the WASM build path, native sharp and production startup. It cannot certify the host's exact libc. The initial native-compiler run compiled and typechecked but a page-data worker exited SIGSEGV; the three-worker WASM retry compiled and then exited 137. The Docker VM reported about 2.8 GiB total, shared with existing services. Those failures are retained, not counted as passes. The candidate bounds workers to one; the harness caps build memory/heap and reruns acceptance. See the final checkpoint for actual final results. Hosted build logs and smoke acceptance remain mandatory after separately approved deployment.
