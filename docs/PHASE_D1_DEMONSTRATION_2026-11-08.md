# Phase D1 synthetic demonstrations and actual captures

All journeys ran on a newly created owned loopback MariaDB fixture. The acceptance log is `work/integration-d1-final.log`, copied into the execution backup. The final suite passed 171 checks. Images are actual local browser captures under `test-artifacts/screenshots`, with copies in the D1 backup's `screenshots` directory. They contain synthetic products/orders only. QR tokens belong to the destroyed local fixture and cannot authorize a real pickup. They are not hosted acceptance screenshots.

| Journey | Demonstrated result | Primary evidence |
| --- | --- | --- |
| A Ready | Configured Ham & Cheese + Ají Chicken held together for five DB minutes; verified fake payment; worker checks/set-aside/packing; one Ready capture/pass; scan inspects; explicit handover retires custody/commitment once. | API and browser; images 01–07 |
| B Mixed | Ready Ham + Ají from an already-started batch; waits for actual remaining batch, no timer/other-batch substitution; complete packing produces one Ready pickup. | API/browser; images 08–09 |
| C Uncertainty | Fake timeout protects allocation; duplicate pay creates no second provider call; restart/stale reconciliation succeeds; browser says do not pay again and survives refresh. | API/browser; image 10 and uncertain-mobile |
| D Failure | Definite failure/decline releases once; repeated reconciliation does not release twice. | API assertions |
| E Last unit | Concurrent customers produce one successful hold and one conflict. | API concurrency assertion |
| F QR race | Concurrent authenticated workers produce one collection and one conflict; duplicate inspection is harmless; no double availability deduction. | API race; browser images 06–07 |
| G Email failure | Ready delivery failure changes neither payment nor fulfilment/stock; expired running-job lease is reclaimed after app restart and captures once; obsolete Ready suppressed after shortage. | API restart/outbox checks; image 05 shows successful local preview |
| H Late payment | A legitimately released hold cannot steal a second customer's final unit; late paid exception pauses intake and rejects unavailable exact resolution. Separate case restores the whole original basket when it still fits. | API assertions |
| I Stale/containment | Stale blocks new holds and unsafe physical writes but allows payment resolution. After reviewed reconnect, existing paid orders can be packed/collected while Closed and intake disabled. | API restart/containment checks; inherited C stale/offline browser checks |

## Capture inventory

| Actual filename | View |
| --- | --- |
| `d1-01-ready-checkout.png` | Ready-only customer bag and authoritative configured total |
| `d1-02-payment-confirmed.png` | Paid, awaiting physical packing |
| `d1-03-worker-pickup-queue.png` | Authenticated paid order, checkboxes and set-aside/pack actions |
| `d1-04-ready-qr-pass.png` | Ready customer status and private QR pass |
| `d1-05-ready-email-preview.png` | Local Ready email/QR capture; no message sent |
| `d1-06-qr-inspection.png` | Read-only scan inspection before handover |
| `d1-07-handover-recorded.png` | Explicit handover recorded and duplicate warning |
| `d1-08-mixed-checkout.png` | Ready + already-baking checkout |
| `d1-09-mixed-waiting.png` | Customer waits for remaining food |
| `d1-10-payment-uncertain.png` | Protected uncertain payment; no new Pay control |
| `d1-checkout-tablet.png`, `d1-checkout-mobile.png`, `d1-checkout-narrow.png` | Responsive bag at 768/390/320 pixels |
| `d1-ready-mobile.png`, `d1-ready-narrow.png` | Responsive Ready status |
| `d1-pass-mobile.png`, `d1-pass-narrow.png` | Responsive pickup pass |
| `d1-uncertain-mobile.png` | Mobile uncertain-payment guidance |
| `d1-manual-offline.png` | Manual lookup/offline failure with no queued handover replay |

The browser also proves unpaid-hold refresh/payment resume, switching status links, route-specific camera permissions, anonymous scanner denial, authenticated manual lookup and no client exceptions. Camera permission/decoder/media playback are stubs: real tablet/phone optics and browser support require the D2 device package. Email preview is not real-inbox deliverability or rendering evidence. No third-party requests, real email, real provider payment or real customer data are part of these demonstrations.
