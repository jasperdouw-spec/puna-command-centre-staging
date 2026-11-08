# PUNA — Approved Sales Dashboard and Mobile Footer Brief

Date: 2026-11-07
Status: Design requirements approved by owner; implementation NOT authorized as a deployment. Preserve current public website design.

## Sales dashboard — approved direction

- Three tabs: Day, Week, Month. Identical visual system; selected period changes aggregates, trends and comparisons. Provide backward/forward date navigation and custom date selection; all imported historical periods accessible.
- Four primary KPI cards: Net sales, Transactions, Average order value, Items sold. Each has a compact sparkline and selecting it displays a larger detailed chart for the selected day (hourly), week (daily), or month (daily/appropriate grouping).
- Show percentage change versus a meaningful comparable period (e.g. same weekday previous week, previous complete week, previous month); clearly label comparisons and distinguish partial periods.
- Secondary collapsible KPI section: Refunds, Discounts, Taxes, Tips; support appropriate graphs and transparent definitions. Avoid double counting taxes/tips in net sales.
- Below charts, show product-level sales breakdown with donut/pie chart and sortable table: product name, net revenue, revenue share, quantity sold, and refunds as available. Toggle between revenue share and quantity share. Selecting a product opens its period trend, quantity, refunds, and revenue details.
- Show Square sync timestamp, reconciliation/import completeness, data freshness and any incomplete or unmapped records. Use existing reconciled reporting ledger and source recipes, not raw additive totals from CSV/API/order/refund sources. Avoid inventing costs or calling revenue profit.
- Mobile-first, polished, accessible, simple for Jose. Preserve current CRM palette (cream, ivory, charcoal, golden amber, muted olive). Real data only; the chat dashboard mockup used illustrative figures.
- Preserve all existing reporting routes, access controls, source provenance, and accounting definitions. Verify data and period boundaries in America/Vancouver, including DST, before implementation.

## Public website mobile footer — approved refinement

Reference: user's 2026-11-07 screenshot showing cream story section abruptly meeting black location/footer area. User likes existing design; no redesign.

- Add substantial top/bottom padding around 'Find Puna at the truck' in the black area, especially on mobile, to remove crowded appearance at cream-to-black transition.
- Create clear typographic hierarchy for location heading, Canadian Princess address, opening-hours status, and pickup instructions. Increase vertical rhythm and line-height; avoid text hugging the left edge.
- Separate location block from logo, tagline, Instagram, team sign-in and staging notice. Keep existing brand colors, typography, assets, layout intent and copy unless necessary for clarity.
- Respect mobile sticky bag bar, safe areas and narrow screens; ensure footer content is not obscured or visually crowded. Test at 390px and narrower and desktop.
- Do not invent opening hours or activate ordering. Keep staging messaging and checkout disabled.

## Next Work session

Combine this brief with docs/WEBSITE_PRELAUNCH_AUDIT_2026-11-07.md. Inspect current branch and deployed staging before coding. Implement on separate feature branch, run typecheck/build/integration/browser/accessibility checks, and present screenshots and a concise change report for approval. No merge/deploy, DB migration, Square permission changes or payment activation without approval.

Update documentation in GitHub and existing PUNA Google Drive project folder, and maintain/verify a local Pacific Core copy/backup. Report readback/checksum results or failures explicitly. Do not claim Drive/local backup succeeded without verification.

## PUNA Live Kitchen — approved scope (2026-11-07)

Decision: support BOTH immediate purchases of ready-to-sell empanadas and prepaid reservations of real batches already in the oven. Do not sell hypothetical future batches not yet started. This is an implementation requirement, NOT permission to activate payment, checkout or deploy.

### Worker experience
- Add a streamlined, touch-friendly Live Kitchen screen within existing food-truck worker workspace; preserve existing inventory/CRM.
- Product-level +/- quantity entry for each oven batch; staff choose estimated 20/25/30-minute bake duration and tap Start Baking.
- Store batch IDs, product quantities, actual start timestamp, estimated finish timestamp, worker attribution, and audit events. Countdown is a prediction; only staff can mark Ready. Support delays, corrections, wastage and partial readiness with clear history.
- Show ready, baking, allocated/reserved and available-for-walk-in quantities separately. Quick sale/adjustment and pickup completion controls; prevent double deduction when Square sale imports arrive.
- Track per-product allocation by batch and prevent over-reservation or negative stock. Physically label/set aside prepaid items at pickup.

### Customer website
- Add a restrained, brand-consistent live availability panel on the existing homepage: Ready now and Baking, per-product quantities, estimated completion times, last updated timestamp and clear stale/offline status.
- Offer Ready now purchase and Baking reservation, with one pickup when all selected items are confirmed ready. Do not guarantee an exact time from an estimate.
- Do not expose private operational data or staff details.

### Payment and reservation
- Use existing Square integration architecture after separately approved activation; no new payment provider.
- Revalidate inventory atomically server-side at checkout; create expiring short-lived holds (target ~5 minutes) and release on timeout/failure.
- Confirm reservation only after authoritative payment success; implement idempotency, reconciliation, delayed webhook handling and refund/cancellation workflows. Never double charge or oversell.
- Protect reserved stock from online and walk-in sale counts, with explicit staff pickup allocation. Synchronize Square in-person sales safely and flag conflicts/lag.
- Email confirmation and secure order-status link; send pickup-ready notification after staff confirmation. SMS optional later.
- Provide truck Open/Paused/Closed state and fail-safe when internet/data freshness is insufficient. Define pickup deadline, late arrival, refund and food-safety policies with owner approval before launch.

### Delivery phases and safeguards
1. Build/test production batches, countdown, staff controls, public read-only availability, and reconciled inventory WITHOUT accepting payment.
2. Separately build/test secure Square online checkout, holds, notifications and pickup management; activate only after explicit owner approval and end-to-end hosted acceptance.
- Do not modify existing staging checkout-disabled mode, production Square authorization scopes, database schema or migrations without explicit separate approval. Schema design/proposal is allowed; execution is not.
- Verify role-based access, concurrent checkout, partial batches, timer drift, stale inventory, refunds, cancellations, DST and network interruptions.
- Update GitHub and Google Drive project documentation, maintain and verify a local Pacific Core backup; explicitly report any failed access/readback or missing checksum.
