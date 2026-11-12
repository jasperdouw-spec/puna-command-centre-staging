# Privacy and measurement — unpublished review draft

Status: preparation only. No public policy route or footer policy link, analytics SDK, cookies, tracking requests, measurement ID or GTM container has been activated. `lib/analytics-plan.ts` is an unimported, disabled specification. Checkout stays disabled.

## Proposed public wording, subject to factual and policy approval

PUNA uses information you provide to answer enquiries and, when ordering is available, prepare and fulfil your order. This can include your name, contact details, order contents and pickup information. Our service providers process information needed to host the website, process payments and deliver service messages. Staff access is restricted according to their role.

The website uses necessary functions to maintain your bag and secure staff sessions. Optional audience measurement will be explained here before it is enabled, including your choices. Order confirmations and pickup messages are service messages; marketing requires a separate choice.

We retain information for the purposes described here and applicable recordkeeping obligations, then delete or de-identify it under our retention schedule. Contact [approved privacy contact] to ask about your information, request access or correction, or raise a concern. We will explain any records we must retain.

Do not publish this wording until the legal business identity, privacy contact, effective date, actual providers and processing locations, retention periods, deletion/request workflow, backups/log retention, consent and marketing decisions have been confirmed. No retention duration, legal compliance claim, sale-of-data claim, cross-border guarantee or active provider is implied by this draft. Have the owner review the final facts and obtain any needed privacy advice before publication.

## Inactive measurement proposal

Begin with public homepage/menu interactions only. Exclude all owner/worker/authentication, recovery, cart, receipt, API and QR routes. Disable advertising features, Google Signals, user IDs, cross-domain linking, enhanced measurement and automatic page views pending explicit review. Propose basic consent mode with no analytics network request before permission; declining must leave normal navigation usable. Revisit retention, consent region rules, data deletion and policy wording with the owner.

Proposed events: `view_menu`, `select_product`, `begin_checkout`, `purchase`. The last two remain unavailable until commerce is separately approved. Use a reviewed allowlist of non-personal catalogue IDs, quantity, currency and cents. Never send names, emails, telephone numbers, notes, order/receipt/QR tokens, full URLs or query strings. A later purchase event must come from verified payment state and have an idempotency key; a thank-you-page visit is not payment proof. Do not activate staff routes for debugging.

Before activation: verify ownership of the existing GA4 property/GTM container, approve measurement scope and retention, update the policy, test reject/accept/revoke behavior and outgoing payloads, and obtain a separate production release approval. Staging remains noindex/nofollow and tracking-disabled throughout.
