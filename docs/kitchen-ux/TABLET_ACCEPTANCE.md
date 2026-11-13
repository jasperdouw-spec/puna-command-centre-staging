# PUNA tablet — kitchen workflow update

The business interface remains separate from PUNA Control Agent, ADB and WireGuard administration. No Android configuration or network policy changed in this release.

## Staff sequence

1. Sign in at `https://staging.punaempanadas.ca/food-truck`.
2. Read the saved counts, paid items and exceptions. Physically check the truck. Tick the confirmation and connect this screen. Connecting pauses intake; it never resets quantities.
3. Correct physical display counts using the large buttons. Use Batch tools for allocation transfers, waste or a manager's verified replacement count. The Website and Counter labels explain which free food will appear online.
4. Select Open after the stock is correct and issues are resolved. The badge reflects effective status. Checkout remains closed for this staging release.
5. Use Start baking on the relevant product. New-batch +/- controls edit a proposed batch; Start baking records the actual food. Existing-batch +/- changes the recorded batch. Select Working batch when several are baking.
6. Check food physically, enter Units checked ready, then Move to display. The remainder stays in the oven batch. A finished timer never transfers stock automatically.
7. Use Preview customer website inside the kitchen screen to inspect the live cabinet. Keep the kitchen screen visible during service.

Leaving the page, switching apps or locking Android stops the screen heartbeat. Availability pauses at 90 seconds after the last heartbeat. Stock is retained. Return before expiry and the same screen can continue; after expiry, refresh, review, connect and select Open again. A stock review is also due every 15 minutes. Network interruption blocks writes; reconnection never replays taps. Resolve any unknown result by reading stock and audit history before repeating it.

## Physical acceptance status

Not completed in this Work session. Standard ADB and the project's official ADB 36.0.2 command for device HA2GTB92 at server port 5038 could not start their local listener: the execution sandbox denied the socket operation. No security restriction was bypassed. No actual Lenovo touchscreen, Wi-Fi interruption, Android app switching or Control Agent acceptance is claimed.

The automated suite uses a Chromium context with touch enabled at 800×1280, 390×844 and 320×740, plus desktop reporting. It covers touch taps, saved counts, batches, partial transfers, ETA/cancellation, allocation/walk-in controls, offline reconnect, navigation expiry and sign-in expiry against a disposable database. Record its final result in REPORT.md.

Next physical acceptance must use an isolated fixture deployment or a verified physical count with normal audit entries. Do not delete the existing 14 staging units simply because they may be earlier test entries. Verify the ledger first and record any authorized correction with its reason. Confirm the full workflow above, app switching beyond 90 seconds, screen lock, Wi-Fi interruption/recovery and chart touch tooltips. Keep customer checkout and automatic Square deductions disabled.
