# PUNA website pre-launch SEO, accessibility and UX audit

Date: 2026-11-07
Repository: jasperdouw-spec/puna-command-centre-staging
Branch inspected: review/puna-isolated-integration
Scope: targeted read-only source review, NOT exhaustive repository crawl or hosted acceptance test.

## Checklist

| # | Requirement | Finding | Evidence / next verification |
|---|---|---|---|
| 1 | Custom 404 page | Missing at conventional route | app/not-found.tsx not found; inspect other not-found handlers |
| 2 | CTA above fold | Implemented in hero/header; viewport untested | app/puna-app.tsx lines 61-63: Order for pickup, Find your flavour, How pickup works |
| 3 | Meta title per page | Partial | app/layout.tsx global title; app/workspace/page.tsx title override; inventory all public routes |
| 4 | Meta description per page | Partial | app/layout.tsx global description; inventory route-specific descriptions |
| 5 | Open Graph image | Unverified | No app/opengraph-image.png; inspect other image paths and metadata |
| 6 | Favicon | Verified in source | app/layout.tsx icons and public/favicon.svg; currently simple orange P |
| 7 | robots.txt | Unverified / conventional paths absent | public/robots.txt and app/robots.ts not found; test hosted /robots.txt and other handlers |
| 8 | sitemap.xml | Unverified / conventional paths absent | public/sitemap.xml and app/sitemap.ts not found; test hosted /sitemap.xml and other handlers |
| 9 | Image alt text | Verified for inspected public homepage images only | app/puna-app.tsx Photo alt required; logo and Photo uses have descriptive alt; audit all routes |
| 10 | Loading states | Implemented in customer/sign-in flows; global route state absent | app/puna-app.tsx loaded/busy and payment progress; app/sign-in/page.tsx busy; app/loading.tsx absent |
| 11 | Privacy policy page | Missing at standard route; broader inventory needed | app/privacy/page.tsx absent; no privacy link in inspected homepage footer |
| 12 | Analytics | Unverified | No GA/GTM initialization in inspected app/layout.tsx; search all routes, scripts, hosting injections |

## Critical staging protection

app/layout.tsx contains `robots: { index: false, follow: false }`. Preserve noindex/nofollow on staging. Never enable indexing or checkout, change production, alter Square credentials, migrate databases or deploy without separate authorization.

## Work-session plan

1. Audit full repository tree, all Next.js routes and public assets; check live staging HTTP responses and mobile viewport, without changing anything. Record file paths, lines and verified/missing/unverified evidence. Check if the deployed build matches the reviewed branch before attributing source findings to hosting.
2. Prepare minimal, accessible, brand-consistent improvements for missing items: branded 404, unique public metadata, Open Graph/social image, favicon polish, staging-safe robots/sitemap handling, descriptive image alt coverage, privacy policy and footer link, and meaningful loading/error states.
3. Analytics: first inspect existing consent/analytics infrastructure. Recommend a privacy-compliant GA4/GTM event plan. Do not install trackers or collect data without approval of measurement IDs, consent and policy text.
4. Test via typecheck, build, existing test suite, browser/SEO/accessibility smoke tests. Preserve disabled checkout and noindex on staging. Do not deploy, merge, change database or connect providers without explicit authorization.
5. Document evidence, decisions, outstanding approvals and test outcomes in repo and Google Drive; keep verified local backup on Pacific Core (/Volumes/PacificData/Atlas/documentation-sync/ or established project backup path). Never claim Drive/local backup success without readback and checksums; report access failures.

## Source links

- app/layout.tsx
- app/puna-app.tsx
- app/sign-in/page.tsx
- app/workspace/page.tsx
- public/favicon.svg
- README.md

This is a planning audit, not a claim that absent conventional paths prove absence everywhere.
