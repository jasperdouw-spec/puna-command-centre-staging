# PUNA Tablet — menu publication acceptance
13 November 2026

Staging now publishes Chimichurri and four Sanpellegrino flavours, grouped into one Drinks card. Menu & Products provides visible success/errors, immediate Published state and separate ingredient verification. No Android/Control Agent business logic was changed.

Passed: automated Chromium touch actions for editing, validation, publishing, unpublishing, failed post-publish refresh and independent customer-menu refresh; hosted 800 × 1280 layout with no horizontal overflow; hosted 390px phone and 1440px desktop checks; four-flavour selection and optional bag additions. Existing inventory lots, kitchen state and stock history were preserved.

Physical Lenovo TB305FU acceptance remains outstanding. ADB failed to establish the local smart-socket listener (Operation not permitted; USB interface error e00002be). No actual touchscreen, camera, Android sleep or Wi-Fi recovery success is claimed for this release.

On the device, sign in, open Menu & Products, verify the five Published products, open one editor and confirm its food-information review warning. Preview the customer menu, select all four flavours and confirm separate current quantities. Add empanadas to the preview bag and confirm optional two-per-four Chimichurri and drink suggestions without checkout. Test a disposable product's publish/unpublish with visible feedback. Never certify physical stock or ingredients merely to satisfy acceptance. Checkout remains disabled.

Complete report and rollback: docs/menu-publishing/RELEASE-REPORT.md and IMPLEMENTATION.md in the established PUNA website repository. Local evidence: test-artifacts/menu-publishing/. No separate inventory system or Control Agent stock authority was introduced.
