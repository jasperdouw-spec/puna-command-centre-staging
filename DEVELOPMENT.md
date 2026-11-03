# Unified Puna staging development

The single intended deployment is the existing staging.punaempanadas.ca website. Work stays on review/puna-isolated-integration. Do not merge main or deploy without verified current Hostinger configuration and exact approvals. No new website, repository or public preview is needed.

The preserved public website, owner workspace and restricted worker workspace use one database and session system. The pending owner UI uses a sidebar with a cream, charcoal, golden amber and muted olive palette; its styles are scoped to the owner workspace. This source change is not deployed: the hosted release remains `c6a70fcbcf9968255175d19e21735d634b3240e7`. The original magenta website remains unchanged while this integration is reviewed. See INTEGRATION.md for provenance, unfinished modules, data mappings and release gates.

Use npm ci, npm run typecheck and npm run build. Application integration/browser tests run exclusively in the authorized GitHub Actions job on a standard GitHub-hosted Linux runner with disposable MariaDB and synthetic data. Do not run localhost experiments on the MacBook or contact Pacific Core/Mac mini. Never copy private recovery material or production credentials into CI.

No schema migration runs automatically. Inspect current schema and data before proposing additive changes for the isolated staging database. Existing seed files are not a migration or authorization to reset records. db/004 requires a version-column preflight; db/005 introduces staging settings and test orders only after separate approval. No live order/payment or publishing integration is connected.

The pending CRM reads customer history from existing paid pickup orders, separating real and sandbox records. Private notes use the additive `db/007_customer_notes.sql` migration, which requires hosted inspection, a verified private backup and separate exact migration approval. Customer history remains available without that migration; note editing must stay unavailable until its table exists. Do not apply migration SQL as part of a UI deployment.

The local archived-deployment recovery rehearsal is still BLOCKED. Passing synthetic integration tests does not verify restoration, live data migration, current magenta drift or hosted operations. Obsolete resources may be removed only after replacement/migration/recovery acceptance and individual resource-specific confirmations.
