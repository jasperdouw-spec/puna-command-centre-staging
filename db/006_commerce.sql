-- Additive application schema. No seeds, imports, resets or alteration of existing tables.
-- Apply through the guarded migration runner after exact-resource approval and private backup.
CREATE TABLE IF NOT EXISTS schema_migrations (
 id VARCHAR(80) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commerce_products (
 product_id VARCHAR(64) PRIMARY KEY, canonical_id VARCHAR(80) NOT NULL UNIQUE,
 category ENUM('empanada','sauce','drink','ingredient') NOT NULL,
 publication ENUM('draft','staging') NOT NULL DEFAULT 'draft',
 price_confirmed BOOLEAN NOT NULL DEFAULT FALSE, ingredients_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
 tax_rules LONGTEXT NULL, deposit_cents INT UNSIGNED NULL,
 oven_units INT UNSIGNED NOT NULL DEFAULT 1, packing_seconds INT UNSIGNED NULL,
 source_reference VARCHAR(500) NULL, source_hash CHAR(64) NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS inventory_balances (
 product_id VARCHAR(64) NOT NULL, location ENUM('truck','factory') NOT NULL,
 stage ENUM('ingredient','frozen','baking','ready','portion','packaged') NOT NULL,
 physical_units INT UNSIGNED NOT NULL DEFAULT 0, committed_units INT UNSIGNED NOT NULL DEFAULT 0,
 known BOOLEAN NOT NULL DEFAULT FALSE, version INT UNSIGNED NOT NULL DEFAULT 1,
 counted_at DATETIME(3) NULL, counted_by BIGINT UNSIGNED NULL,
 PRIMARY KEY(product_id,location,stage), FOREIGN KEY(product_id) REFERENCES products(id),
 FOREIGN KEY(counted_by) REFERENCES users(id), CHECK(committed_units<=physical_units)
);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id CHAR(36) PRIMARY KEY, operation_key VARCHAR(150) NOT NULL UNIQUE,
 product_id VARCHAR(64) NOT NULL, from_location VARCHAR(20) NULL, to_location VARCHAR(20) NULL,
 from_stage VARCHAR(20) NULL, to_stage VARCHAR(20) NULL,
 quantity INT NOT NULL, kind ENUM('opening','receipt','production','transfer','reserve','release','load','ready','collect','waste','adjustment') NOT NULL,
 reason VARCHAR(500) NOT NULL, actor_id BIGINT UNSIGNED NULL, reference_id VARCHAR(120) NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX(product_id,created_at)
);
CREATE TABLE IF NOT EXISTS capacity_versions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, effective_at DATETIME(3) NOT NULL,
 configuration LONGTEXT NOT NULL, created_by BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS service_batches (
 id CHAR(36) PRIMARY KEY, configuration_id BIGINT UNSIGNED NOT NULL,
 bake_at DATETIME(3) NOT NULL, cutoff_at DATETIME(3) NOT NULL,
 pickup_at DATETIME(3) NOT NULL, pickup_until DATETIME(3) NOT NULL,
 oven_capacity INT UNSIGNED NOT NULL, packing_capacity_seconds INT UNSIGNED NOT NULL,
 oven_committed INT UNSIGNED NOT NULL DEFAULT 0, packing_committed_seconds INT UNSIGNED NOT NULL DEFAULT 0,
 state ENUM('open','paused','closed','loaded','ready','completed') NOT NULL DEFAULT 'open',
 manifest LONGTEXT NULL, exception_note VARCHAR(500) NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY(configuration_id) REFERENCES capacity_versions(id),
 UNIQUE(bake_at), INDEX(pickup_at,state),
 CHECK(oven_committed<=oven_capacity), CHECK(packing_committed_seconds<=packing_capacity_seconds),
 CHECK(cutoff_at<=bake_at), CHECK(bake_at<pickup_at), CHECK(pickup_at<pickup_until)
);
CREATE TABLE IF NOT EXISTS pickup_orders (
 id CHAR(36) PRIMARY KEY, checkout_key CHAR(36) NOT NULL UNIQUE, request_hash CHAR(64) NOT NULL,
 receipt_hash CHAR(64) NOT NULL UNIQUE, batch_id CHAR(36) NOT NULL,
 payment_status ENUM('unpaid','inflight','uncertain','paid','failed') NOT NULL DEFAULT 'unpaid',
 refund_status ENUM('none','pending','partial','refunded','failed') NOT NULL DEFAULT 'none',
 order_status ENUM('open','exception','cancelled','complete') NOT NULL DEFAULT 'open',
 fulfilment_status ENUM('reserved','loaded','ready','collected') NOT NULL DEFAULT 'reserved',
 hold_status ENUM('held','committed','released') NOT NULL DEFAULT 'held',
 expires_at DATETIME(3) NOT NULL, contact_name VARCHAR(80) NOT NULL,
 contact_email VARCHAR(254) NOT NULL, subtotal_cents INT UNSIGNED NOT NULL,
 discount_cents INT UNSIGNED NOT NULL DEFAULT 0, tax_cents INT UNSIGNED NOT NULL,
 deposit_cents INT UNSIGNED NOT NULL, total_cents INT UNSIGNED NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'CAD', is_test BOOLEAN NOT NULL DEFAULT TRUE,
 square_order_id VARCHAR(100) NULL UNIQUE, square_payment_id VARCHAR(100) NULL UNIQUE,
 payment_idempotency_key CHAR(36) NOT NULL UNIQUE, version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(batch_id) REFERENCES service_batches(id),
 INDEX(batch_id,payment_status,fulfilment_status), INDEX(hold_status,expires_at),
 CHECK(total_cents=subtotal_cents-discount_cents+tax_cents+deposit_cents)
);
CREATE TABLE IF NOT EXISTS pickup_order_lines (
 order_id CHAR(36) NOT NULL, product_id VARCHAR(64) NOT NULL,
 name VARCHAR(120) NOT NULL, quantity INT UNSIGNED NOT NULL,
 unit_price_cents INT UNSIGNED NOT NULL, tax_snapshot LONGTEXT NOT NULL,
 tax_cents INT UNSIGNED NOT NULL, deposit_cents INT UNSIGNED NOT NULL,
 oven_units INT UNSIGNED NOT NULL, packing_seconds INT UNSIGNED NOT NULL,
 inventory_stage ENUM('frozen','portion','packaged') NOT NULL,
 PRIMARY KEY(order_id,product_id), FOREIGN KEY(order_id) REFERENCES pickup_orders(id),
 FOREIGN KEY(product_id) REFERENCES products(id), CHECK(quantity>0)
);
CREATE TABLE IF NOT EXISTS provider_events (
 provider VARCHAR(30) NOT NULL, event_id VARCHAR(150) NOT NULL,
 object_id VARCHAR(150) NOT NULL, event_type VARCHAR(80) NOT NULL,
 body_hash CHAR(64) NOT NULL, received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(provider,event_id)
);
CREATE TABLE IF NOT EXISTS provider_jobs (
 id CHAR(36) PRIMARY KEY, kind ENUM('reconcile_payment','refund','receipt') NOT NULL,
 order_id CHAR(36) NOT NULL, status ENUM('pending','running','done','blocked') NOT NULL DEFAULT 'pending',
 attempt_count INT UNSIGNED NOT NULL DEFAULT 0, available_at DATETIME(3) NOT NULL,
 locked_until DATETIME(3) NULL, last_error_code VARCHAR(80) NULL, operation_key VARCHAR(150) NOT NULL UNIQUE,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), INDEX(status,available_at)
);
CREATE TABLE IF NOT EXISTS refunds (
 id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL, provider_refund_id VARCHAR(100) NULL UNIQUE,
 amount_cents INT UNSIGNED NOT NULL, reason VARCHAR(300) NOT NULL,
 state ENUM('requested','pending','completed','failed') NOT NULL DEFAULT 'requested',
 requested_by BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id), FOREIGN KEY(requested_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS user_preferences (
 user_id BIGINT UNSIGNED PRIMARY KEY, workspace_view ENUM('orbital','classic') NOT NULL DEFAULT 'orbital',
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS external_identities (
 provider ENUM('google') NOT NULL, subject VARCHAR(255) NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(provider,subject), UNIQUE(provider,user_id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS team_invitations (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL, role ENUM('owner','staff') NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE, invited_by BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME(3) NOT NULL, accepted_user_id BIGINT UNSIGNED NULL, revoked BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(invited_by) REFERENCES users(id), FOREIGN KEY(accepted_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS identity_challenges (
 state_hash CHAR(64) PRIMARY KEY, nonce_hash CHAR(64) NOT NULL, user_id BIGINT UNSIGNED NULL,
 invitation_hash CHAR(64) NULL, expires_at DATETIME(3) NOT NULL,
 consumed BOOLEAN NOT NULL DEFAULT FALSE, code_verifier VARCHAR(128) NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS source_imports (
 source_key VARCHAR(160) PRIMARY KEY, source_hash CHAR(64) NOT NULL, target_type VARCHAR(40) NOT NULL,
 target_id VARCHAR(100) NOT NULL, target_version INT UNSIGNED NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS recipe_versions (
 id CHAR(36) PRIMARY KEY, product_id VARCHAR(64) NOT NULL, version INT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL, yield_units DECIMAL(14,4) NULL,
 ingredients LONGTEXT NOT NULL, labour_minutes DECIMAL(14,4) NULL,
 labour_rate_cents INT UNSIGNED NULL, packaging_cents INT UNSIGNED NULL,
 source_reference VARCHAR(500) NOT NULL, source_hash CHAR(64) NOT NULL,
 verification ENUM('incomplete','verified') NOT NULL DEFAULT 'incomplete',
 created_by BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(product_id,version), FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS production_runs (
 id CHAR(36) PRIMARY KEY, operation_key VARCHAR(150) NOT NULL UNIQUE,
 recipe_id CHAR(36) NOT NULL, output_units INT UNSIGNED NOT NULL,
 waste_units INT UNSIGNED NOT NULL DEFAULT 0, actor_id BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(recipe_id) REFERENCES recipe_versions(id), FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS ingredient_costs (
 product_id VARCHAR(64) PRIMARY KEY, supplier VARCHAR(160) NOT NULL,
 package_quantity DECIMAL(14,4) NULL, base_unit ENUM('g','ml','each') NOT NULL,
 package_cost_cents INT UNSIGNED NULL, source_reference VARCHAR(500) NOT NULL,
 raw_source LONGTEXT NOT NULL, verified BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS website_revisions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, base_version INT UNSIGNED NOT NULL,
 value LONGTEXT NOT NULL, status ENUM('draft','published') NOT NULL DEFAULT 'draft',
 created_by BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS historical_sales (
 source_key VARCHAR(180) PRIMARY KEY, source_hash CHAR(64) NOT NULL, sold_at DATETIME NOT NULL,
 canonical_id VARCHAR(80) NULL, gross_cents BIGINT NOT NULL, discount_cents BIGINT NOT NULL,
 refund_cents BIGINT NOT NULL, tax_cents BIGINT NOT NULL, tip_cents BIGINT NOT NULL,
 quantity DECIMAL(14,4) NOT NULL, is_test BOOLEAN NOT NULL DEFAULT FALSE,
 source_reference VARCHAR(500) NOT NULL, INDEX(sold_at)
);
CREATE TABLE IF NOT EXISTS operations_notices (
 id CHAR(36) PRIMARY KEY, batch_id CHAR(36) NULL, actor_id BIGINT UNSIGNED NOT NULL,
 kind ENUM('shortage','late','pause','stock','payment') NOT NULL, message VARCHAR(1000) NOT NULL,
 status ENUM('open','resolved') NOT NULL DEFAULT 'open', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(batch_id) REFERENCES service_batches(id), FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS request_limits (
 id_hash CHAR(64) PRIMARY KEY, window_at DATETIME(3) NOT NULL, attempts INT UNSIGNED NOT NULL
);
