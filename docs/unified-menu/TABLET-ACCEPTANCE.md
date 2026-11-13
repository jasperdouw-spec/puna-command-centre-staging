# PUNA tablet acceptance — unified menu, 12 November 2026 (Pacific)

## What changed

The website and Command Centre retain the business inventory authority. PUNA Control Agent remains responsible for Android administration only. The kitchen's browser heartbeat now monitors connectivity; it no longer closes an otherwise trusted business session. Closing time, physical-stock confidence and unresolved commitments are checked on the server.

Staff workflow: physically check stock and exceptions; Confirm stock review; choose the Pacific closing time; Open. Business status, customer availability and truck-screen connectivity are shown separately. Default confidence interval is eight hours, configurable by an owner from one to twelve hours. Review again when stock becomes unreliable or the interval expires. Counts, batches and reservations persist across navigation and device sleep. Offline taps are blocked rather than replayed.

The first opening after migration needs an actual staff stock review. The retained staging counts are not evidence of physical food. Do not reset or attest to them without checking the truck.

## Verified in disposable browser/database tests

- Touch events for sign-in, review/Open, display +/- and oven +/-.
- Multiple batches, revised ready time, countdown, cancellation and partial physical readiness.
- Reserved quantities protected through partial readiness, corrections, delays and payment uncertainty.
- Navigation with a browser heartbeat older than 90 seconds retains the Open session and stock.
- Network loss blocks writes; reconnection refreshes authoritative state without replaying taps.
- Expired staff session disables editing and offers sign-in.
- Tablet 800 × 1280, mobile 390 × 844 and narrow 320 × 740 layouts; large stock controls; no horizontal overflow.
- Customer menu separates ready and baking quantities, shows a single menu and uses a non-reserving draft bag.
- Business Open and customer availability Paused remain visibly distinct when confidence is lost.

These are browser simulations, not physical Lenovo acceptance.

## Physical-device result and remaining acceptance

Physical Lenovo testing was unavailable in this session. `adb devices -l` could not claim the USB interface (macOS error e00002be) and could not install its server listener (Operation not permitted). No device authorization, endpoint protection or network policy was changed to bypass this. PUNA Control Agent was not modified.

Run these checks when authorized device access is available, using an isolated synthetic ledger with checkout/provider simulators. Never insert synthetic quantities into the hosted business ledger:

1. Sign in on the Lenovo; review synthetic counts, enter ready stock and open a session with a known closing time.
2. On a second device, verify ready quantities in the original menu cards; create two oven batches with different ETAs and verify separate remaining quantities.
3. Make ready-only, oven-only and mixed synthetic reservations. Verify one pickup window, reserved batch quantities, pending-payment protection and staff commitments.
4. Confirm only part of a batch physically ready. Verify reserved units remain allocated and only free units are offered to others. Delay another batch and resolve the flagged promise.
5. Leave Chrome, lock the Lenovo and let it sleep for at least five minutes. From the second device, verify the backend session remains Open while confidence is valid, device status changes, and counts/commitments persist.
6. Return to Chrome; verify current backend state is restored. Tap +/- rapidly; each acknowledged update must have one audit event and no duplicate stock.
7. Disconnect Wi-Fi during a stock action, then reconnect. Inspect the authoritative ledger/audit before repeating an uncertain tap; confirm no offline queue replays it.
8. Reach the configured closing time and separately expire stock confidence. Verify new reservations fail safely, the menu stays visible, and existing paid pickups remain protected.
9. Verify manual Pause/Close and authorized reopening with a fresh physical review. Expire the staff session and confirm stock editing requires sign-in.
10. Check the menu, kitchen board, batch tools and existing charts in portrait and landscape with the real touchscreen and reduced-motion preference.

Record Android/Chrome versions, device connection method, time, expected/observed result and screenshots. No real payments or customer messages are part of this test.

## Coordination

Website documentation: https://drive.google.com/drive/folders/11j4AaRxTnL0okaAGmuhYEj6v3wfoMv7F

Tablet Project: https://drive.google.com/drive/folders/1jsxbcrbHu5z_v3VcLVL-zVHsKtHMPUYP

Pacific Core local record: `work/live-inventory/docs/unified-menu` beneath the established PUNA website checkout. See RELEASE-REPORT.md and BACKUP-VERIFICATION.md for the final release and verified evidence locations.
