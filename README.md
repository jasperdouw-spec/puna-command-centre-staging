# Unified Puna staging application

Single deployment target: the existing staging.punaempanadas.ca website. The review branch integrates the preserved public website with one session system, the owner orbital dashboard, and a restricted food-truck workspace. It is not deployed.

- `/`: preserved magenta presentation, catalogue and website details read from the same database as the owner dashboard.
- `/sign-in`: one login; `/workspace` grants owners the orbital dashboard and redirects workers to `/food-truck` on the server.
- `/api/products`, `/api/website`, `/api/accounts`: owner only. Food-truck staff can view the operational test-order projection and advance permitted statuses; no product, content, account or finance access.
- Test orders require authentication and explicit `STAGING_TEST_ORDERS_ENABLED=true`. Default is false. No production orders, payments, notifications, webhooks, scheduled jobs or public publishing are connected.
- Product, website, account and test-order mutations are audited in the same database transaction. Product/content/order edits use conflict detection.
- Sales, Production, Inventory, Financials, Marketing and Analytics remain visibly unfinished. Full owner navigation does not imply those integrations are complete.

Use `npm ci`; the lockfile pins the combined dependencies. Runtime aligns with the preserved public application (Next 16.3.4, React 19.2.6, Node >=22.13.0). CI uses a standard GitHub-hosted Linux runner, disposable MariaDB, synthetic accounts/data, bounded job time and screenshot-only artifacts.

No migration SQL is automatically run by application startup or CI deployment. Files in `db/` are proposals for a separately approved isolated staging database; they must not be applied blindly to existing data. See `INTEGRATION.md`.
