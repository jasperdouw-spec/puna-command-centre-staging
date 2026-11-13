# PUNA Tablet Project — Square catalog acceptance handoff

13 November 2026. Square catalog release 37ca6cc / remote b09c169 is deployed to staging. Pickup is Ucluelet only. This is a business website change; the PUNA Control Agent remains separate and is not an inventory authority.

## Verified remotely

- Owner Menu & Products shows read-only Square prices, current sync status, exact product/variation identities and unresolved provider warnings.
- Ten existing product identities are linked; five empanadas remain published and Chimichurri/four drink flavours remain drafts.
- Automatic polling and manual refresh succeed without changing the physical stock ledger or order lines. Existing persistent operating sessions, oven batches and commitments are retained.
- Browser layout checks at 1440×1000, 800×1280 and 390×844 show no horizontal overflow. Mobile price fields are read-only; existing Photo Studio, scheduling, preview and history controls remain present.
- Current Google Maps regular hours were added to staging as informational text. A Tuesday closure or listed opening time does not independently authorize inventory/order processing.
- Automated CI passes 228 integration checks, including the existing ready/oven/mixed-order, reconnect and safety regressions. These are isolated fixtures, not real tablet or Square transaction acceptance.

## Physical acceptance still required

Actual Lenovo access/ADB initialization was unavailable during this session. Do not mark the following passed until performed on the TB305FU Android 15 device:

1. Sign in as owner, open Menu & Products, inspect a linked empanada and each drink flavour, and verify readable price/sync status and comfortable touch controls.
2. Sign in as kitchen staff and verify owner catalog, pricing and publication actions are unavailable.
3. In a disposable test environment, review stock, open the kitchen, create multiple oven batches, reserve ready/oven/mixed orders, perform partial transfers and confirm readiness. An elapsed timer must not release unconfirmed food.
4. Sleep the screen, navigate away and return. The server operating session, counts and commitments must persist independently of browser connectivity.
5. Interrupt Wi-Fi and reconnect. Writes must fail/reconcile safely; no duplicate stock adjustment or order may result. A stale or unavailable backend must prevent checkout.
6. Check photo capture/upload permissions and responsiveness, then packing/collection workflow with optional add-ons using synthetic orders only.

Do not use recorded staging quantities as verified opening stock. Do not change live stock just to satisfy this checklist. Checkout, live payments and automatic POS deductions remain disabled. Provider address, GST product-set calculation, drink deposits and Square Sandbox acceptance remain separate commerce release gates.

Primary website documentation: docs/square-catalog/RELEASE-REPORT.md, IMPLEMENTATION.md and OWNER-REVIEW.md in the established website project. Local root: /Volumes/PacificData/Projects/puna-foods/puna-command-centre-staging/work/live-inventory/ . CI: https://github.com/jasperdouw-spec/puna-command-centre-staging/actions/runs/43398240784 . Rollback uses the OAuth-compatible connection-only release and retains all stock/media/catalog tables.
