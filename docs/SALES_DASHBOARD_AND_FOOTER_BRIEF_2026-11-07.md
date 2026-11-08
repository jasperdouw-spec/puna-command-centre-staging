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

## Live Kitchen — approved checkout and QR pickup refinements (2026-11-07)

Owner approves ready-now and baking-order checkout/pickup proposal, plus QR pickup as the default method.

- Ready-stock sample: 1 Ham & Cheese + 1 Ají Chicken, $16 CAD subtotal; calculate taxes using separately verified applicable rules, never assume rate.
- Reserve all line items atomically in a short-lived (~5 min) stock hold before Square payment. On authoritative successful payment, convert hold to paid reservation. If any line is unavailable, do not charge for a partial order. Handle timeout, failed/uncertain payment, idempotency, webhooks and reconciliation safely.
- Show customer pickup choices only within verified staffed hours: as soon as packed, approximately 15–30 min, or approximately 30–60 min (actual windows/food safety and holding policy require José's approval). For mixed ready+baking orders, default to one pickup after all items are staff-confirmed ready. Never promise exact bake finish.
- In Live Kitchen, add compact pickup queue (To pack, Ready, Baking), new paid-order alert, item checklist, Pack & ready, and Handed to customer states. Ready-now orders are not advertised as ready for pickup until staff actually set aside and confirm packing.
- After successful payment, issue unique secure QR pickup pass on order-status page and in confirmation email, with human-readable order number as fallback. Use opaque unguessable token, no personal details in QR payload, token stored/validated server-side; HTTPS and authenticated worker access required.
- Food truck worker scans using tablet/phone camera in Live Kitchen; scan displays order, paid status, item list, pickup status. Explicit worker tap to mark handed over, with timestamp, worker attribution and audit history. Scanning alone MUST NOT redeem. Reject duplicate redemption and show already-collected warning.
- Manual order-number/name lookup fallback for failed camera, dead phone or missing email; verify identity appropriately. Consider revocation/reissue of compromised pickup pass, offline network handling and no automatic fulfillment on stale data.
- Customers receive payment confirmation, order-status link and staff-triggered pickup-ready notification; no automatic resale of uncollected paid food. Define late pickup/cancellation/refund policies with owner.
- Preserve current disabled checkout, staging noindex, existing database and Square configuration. Implementation/test may be proposed on separate branch; no payment activation, schema migration, merge or deployment without explicit approval.

## PUNA Google Workspace and automation — approved planning scope (2026-11-07)

Owner confirms domain and hosting purchased/controlled under their name. Include Google Workspace onboarding and Google services integrations in the NEXT Work session; do not create accounts or alter DNS yet.

- Establish PUNA-owned Google Workspace for punaempanadas.ca, proposed primary admin@punaempanadas.ca, customer-facing hola@ and orders@ aliases, and Jose's individual mailbox only if separately needed. Confirm admin and business continuity/ownership roles with Jose. Use MFA, recovery methods, least privilege, separate accounts when independent access is needed.
- Inspect registrar/DNS/Hostinger records and any existing mail service before changes. Domain verification, MX, SPF, DKIM, DMARC changes require explicit approval, staged rollback and send/receive tests. Preserve website, subdomains and unrelated DNS.
- Check for an existing Google Business Profile before claiming/creating; verify eligibility, actual truck location, hours and business ownership. Set up domain property in Search Console, GA4, GTM and organized Google Drive; preserve staging noindex and only index approved production pages.
- User wants PUNA Google services connected initially to ChatGPT via supported connected apps and, where available, API/connector tools; verify capabilities separately for Gmail, Drive, Calendar, Business Profile, Search Console, GA4 and GTM. Never assume all Google services are exposed through one ChatGPT connector.
- Plan separate scoped OAuth/API access for Pacific Core/Atlas on Mac mini, with secrets in approved secure storage, credential rotation, auditable automation and explicit write approvals. ChatGPT desktop app is interactive orchestration, not itself guaranteed unattended scheduler. Local automation can use n8n/Atlas scheduled jobs with monitoring and failure alerts.
- Suggested automations: inbox triage/drafts, Drive document organization and verified backups, business review monitoring and draft responses, SEO/indexing alerts, GA4 performance summaries, GTM configuration review, Square reporting freshness and reconciliation.
- Phase work: inventory accounts/permissions and design -> Workspace creation/domain email setup with approval -> service ownership/verification -> ChatGPT connections -> local scoped automation -> monitoring and recovery tests.
- No paid signup, DNS edits, production tracking activation, external public responses, credentials sharing, deployment or payment changes without owner approval.
- Update PUNA Google Drive documentation and verified local Pacific Core backup when accessible, reporting failures transparently.

## Operating model decision — ChatGPT-first, Atlas later (2026-11-07)

Approved architecture: Google Workspace is PUNA's identity/collaboration layer; PUNA database and reconciled Square ledger are operational source of truth; automation is initially supervised through ChatGPT Work/desktop on Pacific Core Mac mini, with later migration to Atlas.

- Phase A (setup/testing): ChatGPT Work on Mac mini leads configuration, integration verification, test execution, documentation and supervised operational workflows. Require explicit approvals for sensitive changes. Do not claim the desktop app alone is an unattended job scheduler; use verified scheduling/integration services where recurring tasks are needed.
- Phase B (first few months): ChatGPT remains primary operator for authorized workflows; collect structured, privacy-minimized operational logs, human corrections, exception cases, reconciliations, test outcomes and written SOPs. Evaluate reliability, latency, cost, security, and recovery. Do not train models on customer personal data without authorization and a lawful basis.
- Phase C (Atlas handoff): Atlas learns from approved SOPs, synthetic test cases and de-identified historical examples first, then accesses live data through least-privilege, auditable APIs after explicit authorization. Run shadow mode against ChatGPT/human-reviewed results, compare discrepancies, then progressively grant low-risk tasks. Keep financial/public/customer-impacting writes approval-gated until proven safe.
- Establish handoff criteria: repeatable test coverage, reconciled sales accuracy, no unhandled duplicate reservations, recoverable failures, role/secret separation, backup restore test, monitoring and rollback plan.
- Preserve Google Drive documentation and verified local Pacific Core copies. Record actual status and failures rather than claiming synchronization.
