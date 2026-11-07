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
