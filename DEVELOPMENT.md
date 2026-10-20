# PUNA Command Centre v1 development

This branch is intentionally **not** connected to the existing Hostinger static demo. Do not deploy to the current static site yet.

## Architecture
Next.js app with Hostinger MySQL/MariaDB. Pacific Core/Atlas integration is optional later. The public Puna website is a separate repository and is not changed.

## Before deployment
1. Complete secure login, password bootstrap, role middleware, session revocation, CSRF/origin validation and authorization tests.
2. Add persistent server-side product, draft and feedback routes with validation, optimistic concurrency and audit logging.
3. Provision a **new** Hostinger database with least-privilege user. Apply `db/001_initial.sql`, then `db/002_initial_catalog.sql` only after review.
4. Configure environment variables in Hostinger; never commit secrets.
5. Verify build, typecheck, tests, staging deployment, backup and rollback.
6. Migrate the hosting slot from static to Next.js only in an attended, approved deployment.

Prices in seed data are provisional website values, not live Square prices. All products start unavailable. No payment processing is implemented.

## Secure login and product editor milestone (2026-10-19)
- Auth API, one-time owner setup screen, hashed sessions, role-checked product GET/PATCH, CSRF origin checks, audit writes and login-attempt throttling are committed.
- **Required migration:** after 001 and 002, import `db/003_auth_rate_limits.sql` into the same dedicated Puna database. The auth API will not work until this table exists.
- Set BOOTSTRAP_TOKEN as a random 32+ character value on staging only. Create the first owner at `/setup`; remove BOOTSTRAP_TOKEN and restart immediately afterward.
- Set DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD only in Hostinger staging environment variables. Never put credentials in GitHub or chat.
- CI workflow runs typecheck and build on the development branch. **Do not consider this code security-tested until CI passes and negative/auth/session/product tests have been run against an isolated staging database.**
- Public demo on `main` stays untouched. Never deploy development branch directly over the static demo.
