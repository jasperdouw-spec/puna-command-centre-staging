# PUNA Tablet Project — Menu & Photo Studio acceptance

Date: 2026-11-13 UTC. Website implementation remains in the established Command Centre repository and documentation folder. PUNA Control Agent is unchanged.

Owner entry: https://staging.punaempanadas.ca/workspace?view=menu
Kitchen entry: https://staging.punaempanadas.ca/food-truck

## Staging deployed — ready for physical-device acceptance

- Owner product drafts, explicit publish, scheduling and history restore.
- Native camera/library file controls; JPEG and PNG up to 8 MiB.
- Automatic deterministic warm treatment, 4:3 framing/zoom, responsive derivatives.
- Private original library and reusable crop versions.
- Drink flavours use separate ready stock; sauces/drinks cannot start baking batches.
- Weekly Specials keep unique IDs and use the existing oven and ready-stock ledgers.
- Green Ready Now, red Not Ready (including explanation when count is unknown), amber In Oven.
- One shopping bag with optional stock-aware sauce/drink suggestions.

## Physical-device limitation

ADB could not initialize the USB interface or install its local smart-socket listener in this session. No physical Lenovo touchscreen, camera, sleep, Wi-Fi or Android file-picker result is claimed. Browser touch simulation and responsive rendering are separate evidence, recorded in the release report.

## Outstanding Lenovo steps

1. As owner, open Menu & Products; save an existing product as a draft without publishing unverified prices.
2. Take a new food photo; verify camera orientation, gallery selection, upload progress, crop adjustment and alt-text review. Cancel any product publication unless its actual content is confirmed.
3. Return after navigating away and after device sleep. Confirm published menu, drafts and photo library are restored from the backend. Kitchen business session must remain independent of browser/device heartbeat.
4. In a disposable test instance, create a drink flavour and special, count ready stock, create an empanada oven batch, reserve a mixed order and verify the packing list.
5. Interrupt Wi-Fi. Ensure writes are blocked and no automatic replay changes stock. Reconnect and review current server state.
6. Check 800px-class tablet and phone layouts, readable status explanations, large buttons, keyboard/focus order and image loading on mobile data.

Live checkout, real charges and automatic Square deductions remain disabled. Do not substitute synthetic quantities for a physical stock count. Coordinate Android permissions and remote connectivity through the existing PUNA Control Agent project; keep stock authority in the website backend.
