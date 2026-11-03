-- Additive customer-note storage for the existing isolated staging database.
-- Inspect current schema and take a verified private backup before an explicitly
-- approved hosted migration. Do not execute automatically during application boot.
-- customer_key is SHA-256 of scope + normalized order email; contact details are
-- not copied here, and sandbox and real customers have separate note identities.
CREATE TABLE IF NOT EXISTS customer_notes (
 customer_key CHAR(64) PRIMARY KEY,
 note VARCHAR(2000) NOT NULL DEFAULT '',
 version INT UNSIGNED NOT NULL DEFAULT 1,
 updated_by BIGINT UNSIGNED NOT NULL,
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(updated_by) REFERENCES users(id)
);
