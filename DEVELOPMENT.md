# Unified Puna staging development

The single intended deployment is the existing staging.punaempanadas.ca website. Work stays on review/puna-isolated-integration. Do not merge main or deploy without verified current Hostinger configuration and exact approvals. No new website, repository or public preview is needed.

The preserved public website, orbital owner dashboard and restricted worker workspace use one database and session system. The original magenta website remains unchanged while this integration is reviewed. See INTEGRATION.md for provenance, unfinished modules, data mappings and release gates.

Use npm ci, npm run typecheck and npm run build. Application integration/browser tests run exclusively in the authorized GitHub Actions job on a standard GitHub-hosted Linux runner with disposable MariaDB and synthetic data. Do not run localhost experiments on the MacBook or contact Pacific Core/Mac mini. Never copy private recovery material or production credentials into CI.

No schema migration runs automatically. Inspect current schema and data before proposing additive changes for the isolated staging database. Existing seed files are not a migration or authorization to reset records. db/004 requires a version-column preflight; db/005 introduces staging settings and test orders only after separate approval. No live order/payment or publishing integration is connected.

The local archived-deployment recovery rehearsal is still BLOCKED. Passing synthetic integration tests does not verify restoration, live data migration, current magenta drift or hosted operations. Obsolete resources may be removed only after replacement/migration/recovery acceptance and individual resource-specific confirmations.
