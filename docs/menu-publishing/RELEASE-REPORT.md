# PUNA menu publishing — completed staging release
13 November 2026 · https://staging.punaempanadas.ca/#menu

## Result

The publishing defect is fixed, deployed and independently verified. All five requested existing products are Published on staging. Chimichurri uses its own original-style menu card; the four Sanpellegrino flavours share one Drinks card with separate availability. There is still one unified menu and one bag.

| Published product | Stable PUNA ID | Square variation | CAD before tax | Existing ready count observed |
| --- | --- | --- | --- | --- |
| PUNA Chimichurri | chimichurri | 3MLJDO7662UGTUMSSY3KURIJ | $3.00 | 6 |
| Sanpellegrino Aranciata | sanpellegrino-aranciata | LO65SJDKRQMPEJTP3E4DCTFW | $3.50 | 6 |
| Sanpellegrino Aranciata Rossa | sanpellegrino-aranciata-rossa | F7CSWPLATCAOVXNZY2RDVTO7 | $3.50 | 4 |
| Sanpellegrino Limonata | sanpellegrino-limonata | E5UE4AZ4UKFJ6SIXQ5IBRT56 | $3.50 | 5 |
| Sanpellegrino Pompelmo | sanpellegrino-pompelmo | 3DNTYOKB46FZVS26Q75AA5B2 | $3.50 | 7 |

These are pre-existing ledger quantities, not new physical-stock verification or synthetic stock inserted by this release. The backend's existing authorized session and confidence policy control whether Ready Now appears. Unknown counts remain visible with Not Ready / Stock count not confirmed. A paused kitchen remains clearly distinguished from a known zero count.

## Cause and fix

The old Publish action rejected blank ingredient fields with HTTP 409, even when the product had a valid Square price and accurate neutral description. The error was buried below the editor, and publication also implicitly certified ingredients. The new workflow separates presentation review from food-information verification. Success/error feedback is prominent and focused; the Published/Draft label immediately reflects the committed server state, including when the following refresh fails. Open customer menus receive publication updates without requiring a page reload.

All five products retain blank ingredient/allergen fields and ingredientsConfirmed=false, visibly flagged for owner review. Descriptions avoid unverified drink volume, deposits, tax treatment or food-safety claims. Chimichurri is described as a small cup per the owner's instruction and remains ready-stock only; all drinks also remain oven-ineligible. No dedicated verified product photographs were attached to these drafts, so none were fabricated. Existing approved photography and card styling are preserved; Photo Studio remains available for owner uploads.

## Hosted acceptance

- Hostinger shows Completed / Current for puna-menu-publishing-d272b42-20261113.zip.
- All five mutations were performed through the authenticated owner editor, with explicit success feedback and persisted Published states. Editing names/descriptions/flavour labels worked.
- Pompelmo was deliberately unpublished, observed disappearing from the already-open four-flavour selector, and republished. It returned without reloading the customer page; final state is Published with all four flavours present. This reversible test is retained in Product History.
- Current Square catalog sync was fresh at 10:05:05 UTC before publication. Exact variation identities and prices matched the existing verified links. Square remains authoritative; no provider catalog or transaction was modified.
- Public API and UI confirmed the five quantities above, green Ready Now, no oven stock for add-ons and individual flavour selection. The menu contains seven cards: five existing empanadas, Chimichurri and Drinks.
- Hosted bag acceptance: four Ham & Cheese empanadas produced an optional two-cup suggestion and all four available drink choices. The subtotal remained $32 before explicit addition. Adding two cups and two Limonata drinks produced $45 / eight items. Suggestions disappeared once their category was in the bag. The preview bag was then emptied. No reservation, order or charge was created.
- Customer menu, bag and owner editor were checked at desktop 1440px, phone 390px and tablet 800px widths, with no horizontal overflow. The four flavours showed their own counts. Keyboard/focus feedback and touch-sized controls were inspected; automated touch tests also passed.
- Public GET /api/puna confirmed testOrdersEnabled=false and orderingLocal=false. Existing Hostinger configuration retains PUNA_CHECKOUT_MODE=disabled, PUNA_ORDERING_ACCEPT_NEW=false and PUNA_SQUARE_POS_ENABLED=false. Production was not deployed.

## Data integrity

Before/after readbacks verified all 13 kitchen lots, unit quantities, lot versions, timings, allocations, kitchen operating state and the returned stock audit history unchanged. Only expected product-name/publication projection fields changed. All previous product-history entries were retained, with 14 new before/after publication/unpublication snapshots. Existing empanada records were unchanged except routine Square verification timestamps. All ten Square mappings and selling prices were preserved.

No schema migration, direct SQL mutation, inventory reset or session-policy change was needed. Saved private acceptance snapshots are under test-artifacts/menu-publishing/ (mode 0600). They contain no credentials. Prior checkpoints and backups remain intact.

## Automated validation

Exact-source CI: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43405748186

- 232 disposable integration checks passed.
- 92 domain checks and 25 boundary tests passed, plus deterministic image-processing assertions.
- TypeScript and the standalone production build passed.
- New tests cover neutral/blank-ingredient publication, explicit food verification, stale edits, retries/idempotency, unpublishing, failed post-save refresh, live customer refresh, four independent flavours and explicit stock-aware add-ons.
- Existing tests cover owner/staff restrictions, inventory concurrency, ready/oven/mixed reservations, protected allocations, failed and uncertain payments, expiry, Square synthetic behavior, photo processing, responsive layouts and synthetic database restore.
- Approved hero and Story screenshot comparisons passed.

Two intermediate runs failed on UI test expectations (old unknown-stock wording; an expected eight drinks despite one protected synthetic allocation). Those assertions were corrected to the verified behavior and the final complete run passed. No failing build was deployed.

## Deployment identity and rollback

- Branch: codex/menu-publishing-20261113.
- Local application commit: d272b42225cb37a341ce45fd5b727ce52410981b.
- Equivalent remote commit: 865908d0c4ee4486506633980ae4e7bdba5a68ec.
- Matching source tree: 1622f7e8c44f0fd0119020da5996ece42c2ce7ce.
- 312-file source ZIP SHA-256: 2955b7f97779864054b92563c64924a72c835b81d7806eb82fa71104e5605d9e.
- Existing Hostinger Node 22 manual source-deployment process; runtime settings unchanged. No PR was merged.

Rollback is documented in IMPLEMENTATION.md. Redeploy the preserved prior Square-compatible 37ca6cc source if needed; retain current product/stock/history data. No database rollback is required. Unpublish affected products through the owner editor instead of deleting records. Never restore stale stock to reverse code changes.

## Remaining limitations and commerce gates

All five requested products are published; none remains blocked in Draft. Physical Lenovo acceptance was not performed: ADB could not establish its local device socket under this session's permissions. Browser touch and tablet-size tests are distinct from real-device testing.

Live commerce remains blocked by the existing Square location-address discrepancy (pickup is Ucluelet only), provider-level tax/deposit validation, unverified food details, Sandbox/payment acceptance and final launch authorization. No real Square charge/refund, automatic POS deduction or customer message was sent. These commerce gates do not hide the approved neutral menu cards.

## Evidence and documentation

Pacific Core documentation: /Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory/docs/menu-publishing/.

Screenshots and private acceptance snapshots: /Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory/test-artifacts/menu-publishing/.

Screenshots include before-publish-error.jpg, owner-publish-success.jpg, owner-editor-desktop/tablet/mobile.jpg, customer-menu-desktop/tablet/mobile.jpg, bag-addons-desktop/mobile.jpg and hostinger-deployment.jpg. VERIFICATION.json records uploaded Drive locations, readback results and archive hashes after saving. The established complete-project reference is updated with this dated checkpoint; the tablet folder receives its acceptance addendum. Earlier reports remain historical checkpoints.
