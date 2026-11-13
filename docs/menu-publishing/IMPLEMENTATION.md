# Menu publication repair — 13 November 2026

## Confirmed cause

The hosted Publish action returned HTTP 409 because the service required a nonempty ingredient list. All five approved add-on drafts had blank, unverified ingredient/allergen fields. Its combined review checkbox incorrectly tied presentation publication to ingredient certification, and the error appeared below the editor's long contents. The database transaction correctly rolled back, leaving Draft.

## Repair

Publication still requires an owner, origin validation, optimistic version, idempotency key, current verified Square mapping/price, a nonempty description, appropriate photo description and explicit presentation review. Ingredients can remain blank for neutral menu publication. Ingredient/allergen verification is a separate explicit control; a changed ingredient/allergen statement clears inherited verification. Empty ingredients cannot be certified. Tax/deposit, price revalidation and commerce activation gates remain independent.

The editor now displays focused, sticky success/error feedback, a Publishing state and immediate authoritative Published/Draft state from the committed server response. A failed subsequent list refresh does not misreport a committed publication as a failure. The API is explicitly dynamic. Customer menus refresh every five seconds, on reconnection/visibility/page return, and through a same-browser publication broadcast; stale request completions are discarded.

Unknown stock is labelled Not Ready / Stock count not confirmed. A known count with paused availability is labelled truthfully. Drink options show independent counts and stock state. Pickup display times use America/Vancouver. Prices are described as before tax, without claiming unresolved tax settings have been verified.

## Scope and preservation

No new schema or destructive migration. Existing product IDs, Square mappings, kitchen lots, reservations and historical orders remain the source of truth. Original card layout, hero, Story, photography, navigation and analytics remain intact. Four published drink products are grouped by the existing Drinks card; no second menu or cart was added. Add-on suggestions require confirmed available quantities and explicit customer action.

## Tests

Additional isolated API tests cover neutral publication, false food certification, explicit verification, changed allergens, duplicate commands, stale versions and unpublishing. Touch browser tests cover focused validation errors, publication with a failed follow-up refresh, another open customer menu updating, unpublish/republish, four flavour states and explicit drink additions. Existing tests cover sauce quantities, dismissal persistence, reservations, payment failures, inventory concurrency, permissions, image processing and responsive design. The final release report records the completed run and hosted results.

## Recovery

Use Menu & Products to unpublish only the affected item or restore its prior draft/content through Product History. Unpublishing stops new menu presentation without deleting stock/history. Re-publish a corrected draft after review; never restore a historical Square selling price independently.

For application rollback, redeploy the preserved Square-compatible source archive puna-square-catalog-37ca6cc-20261113.zip. Keep current data and catalog tables. There is no migration to reverse. Do not restore old inventory merely to undo UI code. The prior build can still display published products, but its ingredient-related publication defect will return. Checkout, live payments and automatic Square deductions must stay disabled.
