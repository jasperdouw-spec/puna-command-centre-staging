-- UNNUMBERED Phase D1 candidate. New guarded disposable synthetic databases only.
-- Extend the existing order records; preserve legacy rows and their stock path.
ALTER TABLE pickup_orders MODIFY batch_id CHAR(36) NULL;
ALTER TABLE pickup_order_lines MODIFY inventory_stage ENUM('frozen','portion','packaged','kitchen') NOT NULL;
ALTER TABLE kitchen_allocations MODIFY created_by BIGINT UNSIGNED NULL,
 ADD COLUMN order_id CHAR(36) NULL UNIQUE,
 ADD CONSTRAINT kitchen_allocation_order_fk FOREIGN KEY(order_id) REFERENCES pickup_orders(id);
CREATE TABLE IF NOT EXISTS kitchen_order_details (
 order_id CHAR(36) PRIMARY KEY, allocation_id CHAR(36) NOT NULL UNIQUE,
 order_number VARCHAR(24) NOT NULL UNIQUE, session_hash CHAR(64) NOT NULL,
 pickup_at DATETIME(3) NOT NULL, access_expires_at DATETIME(3) NOT NULL,
 sealed_access_token TEXT NOT NULL, packed_at DATETIME(3) NULL,
 status_fingerprint CHAR(64) NOT NULL DEFAULT '', issue_code VARCHAR(80) NULL,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), FOREIGN KEY(allocation_id) REFERENCES kitchen_allocations(id),
 INDEX(session_hash), INDEX(pickup_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_payment_attempts (
 id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL UNIQUE,
 provider_key CHAR(36) NOT NULL UNIQUE, provider_payment_id VARCHAR(100) NULL UNIQUE,
 state ENUM('prepared','pending','uncertain','paid','failed','released') NOT NULL DEFAULT 'prepared',
 attempts INT UNSIGNED NOT NULL DEFAULT 0, available_at DATETIME(3) NOT NULL,
 locked_until DATETIME(3) NULL, last_error_code VARCHAR(80) NULL,
 created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), INDEX(state,available_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_pickup_tokens (
 token_hash CHAR(64) PRIMARY KEY, order_id CHAR(36) NOT NULL,
 sealed_token TEXT NOT NULL, expires_at DATETIME(3) NOT NULL,
 revoked_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), INDEX(order_id,revoked_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_order_events (
 operation_key VARCHAR(150) PRIMARY KEY, order_id CHAR(36) NOT NULL,
 actor_id BIGINT UNSIGNED NULL, request_hash CHAR(64) NOT NULL,
 kind VARCHAR(50) NOT NULL, result LONGTEXT NOT NULL, created_at DATETIME(3) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), FOREIGN KEY(actor_id) REFERENCES users(id), INDEX(order_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_notifications (
 id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL,
 kind ENUM('confirmation','ready','delay','exception','cancelled','pass_reissued') NOT NULL,
 dedupe_key VARCHAR(150) NOT NULL UNIQUE, eligibility_hash CHAR(64) NOT NULL,
 state ENUM('pending','running','sent','suppressed') NOT NULL DEFAULT 'pending',
 attempts INT UNSIGNED NOT NULL DEFAULT 0, available_at DATETIME(3) NOT NULL,
 locked_until DATETIME(3) NULL, last_error_code VARCHAR(80) NULL,
 provider_reference VARCHAR(100) NULL, created_at DATETIME(3) NOT NULL, sent_at DATETIME(3) NULL,
 fixture_failures INT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), INDEX(state,available_at)
) ENGINE=InnoDB;
-- Fake-provider persistence is test infrastructure, not a real provider credential store.
CREATE TABLE IF NOT EXISTS local_payment_simulations (
 order_id CHAR(36) PRIMARY KEY, provider_key CHAR(36) NOT NULL UNIQUE,
 scenario VARCHAR(40) NOT NULL DEFAULT 'success', provider_payment_id VARCHAR(100) NOT NULL UNIQUE,
 state VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED', amount_cents INT UNSIGNED NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'CAD', merchant_id VARCHAR(80) NOT NULL DEFAULT 'local-merchant',
 location_id VARCHAR(80) NOT NULL DEFAULT 'local-truck', reference_id CHAR(36) NOT NULL,
 calls INT UNSIGNED NOT NULL DEFAULT 0, latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS local_email_captures (
 id VARCHAR(100) PRIMARY KEY, notification_id CHAR(36) NOT NULL UNIQUE,
 sealed_content LONGTEXT NOT NULL, created_at DATETIME(3) NOT NULL,
 FOREIGN KEY(notification_id) REFERENCES kitchen_notifications(id)
) ENGINE=InnoDB;
