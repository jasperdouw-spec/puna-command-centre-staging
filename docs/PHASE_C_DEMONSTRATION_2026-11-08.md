# Live Kitchen synthetic demonstration

This sequence was executed in local Chrome against a new disposable synthetic database. All quantities, products, orders and payment acknowledgements shown are test data. No Square payment occurred. The test harness removes the database afterward; it is not a permanent running preview.

Reproduce after the local production build with `node tests/run-local-disposable.mjs`. It checks ports, creates/validates its own tmpfs database, runs the existing suite, applies only the guarded candidate, then executes `tests/kitchen-browser.mjs`. Never point it at an existing database or add a private environment file.

Screenshots are in `test-artifacts/screenshots/` locally, and the accepted images are copied into the checkpoint backup's `screenshots/` directory.

| Step | Worker action and verified result | Screenshot |
| --- | --- | --- |
| 1 | Review the authoritative ledger, confirm stock/paid items, connect the screen (Paused), then explicitly Open. Select Golden corn · synthetic, 6 units, online allocation 4, estimate 25 minutes. Start Baking. Reload retains the server finish timestamp and still shows 6 baking. | kitchen-01-start.png |
| 2 | In the synthetic demonstration, reserve 2 online units from that exact batch, then simulate verified payment. Two units are committed; only 2 online units remain free. | kitchen-02-reserved.png |
| 3 | Confirm 3 ready: physical totals become 3 ready + 3 baking, still 6. The paid reservation receives 2 ready within its actual batch; one truck unit is ready. Confirm that the 2 paid units are physically set aside. | kitchen-03-partial-ready.png |
| 4 | Expand the transfer control, choose Online → truck, Baking, quantity 1. Transfer only that free unit. Overall physical stock is unchanged and the paid reservation remains protected. | kitchen-04-transfer.png |
| 5 | Confirm the remaining 3 ready. Reserve 1 ready truck item and physically set it aside. The minimum operating sequence is reserve here → take Square payment → press Paid in Square & handed over. The fixture uses an acknowledgement only. Physical count falls to 5 and the counter commitment retires; free availability is not deducted again. | kitchen-05-counter.png |
| 6 | Start a second actual synthetic batch: 4 spinach/cheese, 2 online, 20 minutes. Public preview shows 1 corn ready and 2 spinach baking, with timestamp and estimate language. The bag does not reserve stock. | kitchen-desktop.png; kitchen-mobile-batch.png; availability-mobile.png |
| 7 | Disconnect the browser: stock actions disable and no operation is queued. Reconnect and refresh. Then the fixture ages the truck heartbeat to 91 seconds while the API remains reachable: server allocations and worker actions pause, public availability becomes unconfirmed, and the paid reservation stays intact. | kitchen-offline.png; kitchen-stale.png; availability-stale.png |
| 8 | Read the fresh ledger, resolve any conflicts, confirm the physical review and reconnect. The screen stays Paused until an explicit Open. | kitchen-reconnected-paused.png |

Additional API tests cover waste below paid commitments, delaying an actual batch past its pickup commitment, concurrent transfers/reservations, a five-minute unpaid expiry versus uncertain payment protection, a 15-minute expired physical review despite a fresh heartbeat, and synthetic collection with no second availability deduction.

The local prototype demonstrates the acknowledgement sequence; staff still need to validate it at the truck. It does not prove that the real Square counter routine, device placement, stock labels or review frequency are workable during service. Online sales remain disabled until that acceptance and a separately approved implementation/release.
