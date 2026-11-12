# PUNA kitchen tablet handoff — November 12, 2026 UTC

The business interface reuses PUNA Command Centre. It is separate from PUNA Control Agent, Android administration and the private WireGuard network. No Android packages, VPN routes, credentials or kiosk settings were changed by this build.

## Entry and permissions

Open the HTTPS PUNA staging site, use Team sign-in, then the existing staff Food Truck screen (`/food-truck`). Owners use Workspace → Kitchen. Existing server roles and secure sessions are required. Do not put passwords, session cookies or API keys in launch shortcuts. Do not grant the device agent authority to change stock.

## Staff workflow

1. Read the authoritative stock and count food physically present. Check protected pickup items separately.
2. Confirm the review and connect this truck screen. It starts paused; select Open only when counts and exceptions are resolved.
3. Use Ready in Display +/− for actual ready food. Minus cannot remove food held for a checkout or paid order.
4. Use In Oven to start one or more batches, adjust quantity and expected time, then transfer only food checked ready. Partial transfers and cancellation of remaining uncommitted baking food are supported.
5. Keep the screen visible. Connection heartbeat is 30 seconds, expiry 90 seconds; review the physical stock at least every 15 minutes.
6. In manual Square mode, reserve walk-in stock through advanced batch controls, set it aside, take payment in Square, then confirm handover once. Never combine manual deduction with automatic POS deduction.

## Interrupted connection

Offline edits are blocked and no queued actions are replayed. After reconnect, refresh authoritative stock and review it before another change. A failed request may already have committed: inspect the resulting count and history before retrying. Do not assume a disappearing spinner means the stock was unchanged.

## Acceptance still requiring the physical Lenovo

Check touch targets on the Lenovo Tab One TB305FU, landscape/portrait, rapid repeated taps, Wi-Fi/VPN interruption, Android sleep/resume, session expiry and reauthentication. Confirm the app returns to a reviewed paused state after a stale connection. Verify displayed quantities against physically counted test food before operational use.

Customer checkout and production payments remain disabled. Automated browser tablet tests are synthetic; they do not establish physical-device acceptance. See the website implementation and validation documents for current release status.
