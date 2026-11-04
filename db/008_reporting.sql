-- Additive extension. Never applied at startup. Requires reviewed 006_commerce.
-- No seed, catalogue, account, inventory, order, or existing history mutations.
CREATE TABLE IF NOT EXISTS sales_batches (
 id CHAR(64) PRIMARY KEY, kind ENUM('csv','reference') NOT NULL,
 state ENUM('preview','complete','failed') NOT NULL DEFAULT 'preview',
 manifest LONGTEXT NOT NULL, preview LONGTEXT NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME(3) NULL, failure_code VARCHAR(80) NULL,
 FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sales_stage (
 batch_id CHAR(64) NOT NULL, ordinal INT UNSIGNED NOT NULL,
 file_hash CHAR(64) NOT NULL, source_row INT UNSIGNED NOT NULL,
 row_hash CHAR(64) NOT NULL, payload LONGTEXT NULL, error_code VARCHAR(80) NULL,
 PRIMARY KEY(batch_id,ordinal), INDEX(row_hash),
 FOREIGN KEY(batch_id) REFERENCES sales_batches(id)
);
CREATE TABLE IF NOT EXISTS sales_mappings (
 source_product_key CHAR(64) PRIMARY KEY, item_name VARCHAR(255) NOT NULL,
 variant_name VARCHAR(255) NOT NULL, sku VARCHAR(255) NOT NULL,
 product_id VARCHAR(64) NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
 reviewed_by BIGINT UNSIGNED NULL, reviewed_at DATETIME(3) NULL,
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(reviewed_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sales_details (
 source_key VARCHAR(180) PRIMARY KEY,
 source_kind ENUM('csv','api') NOT NULL, batch_id CHAR(64) NULL,
 row_hash CHAR(64) NOT NULL, merchant_id VARCHAR(191) NULL,
 transaction_id VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 payment_id VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 order_id VARCHAR(191) COLLATE utf8mb4_bin NULL,
 source_product_key CHAR(64) NOT NULL, category_name VARCHAR(255) NOT NULL,
 location_key VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 local_date DATE NOT NULL, original_timestamp VARCHAR(100) NOT NULL,
 source_timezone VARCHAR(80) NOT NULL, timestamp_status VARCHAR(40) NOT NULL,
 event_type VARCHAR(40) NOT NULL, net_cents BIGINT NOT NULL,
 included BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(source_key) REFERENCES historical_sales(source_key),
 FOREIGN KEY(batch_id) REFERENCES sales_batches(id),
 FOREIGN KEY(source_product_key) REFERENCES sales_mappings(source_product_key),
 INDEX(local_date,included), INDEX(payment_id), INDEX(transaction_id), INDEX(order_id)
);
CREATE TABLE IF NOT EXISTS sales_connection (
 id TINYINT PRIMARY KEY, merchant_id VARCHAR(191) NOT NULL,
 credentials LONGTEXT NOT NULL, expires_at DATETIME(3) NOT NULL,
 identity LONGTEXT NOT NULL, metadata LONGTEXT NULL,
 verified_at DATETIME(3) NULL, last_success DATETIME(3) NULL,
 last_attempt DATETIME(3) NULL, failure_code VARCHAR(80) NULL,
 watermark VARCHAR(40) NULL, version INT UNSIGNED NOT NULL DEFAULT 1
);
-- Provider aggregates are evidence at a different grain. Never union into facts.
CREATE TABLE IF NOT EXISTS sales_report_snapshots (
 id CHAR(64) PRIMARY KEY, profile VARCHAR(40) NOT NULL,
 start_date DATE NOT NULL, end_date DATE NOT NULL, query_json LONGTEXT NOT NULL,
 payload LONGTEXT NOT NULL, fetched_at DATETIME(3) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sales_oauth_states (
 state_hash CHAR(64) PRIMARY KEY, actor_id BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME(3) NOT NULL, FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sales_runs (
 id CHAR(36) PRIMARY KEY, kind ENUM('refresh','backfill') NOT NULL,
 state ENUM('pending','running','complete','failed') NOT NULL,
 start_at VARCHAR(40) NOT NULL, end_at VARCHAR(40) NOT NULL,
 phase ENUM('orders','refunds') NOT NULL DEFAULT 'orders',
 checkpoint_cursor TEXT NULL, location_index INT UNSIGNED NOT NULL DEFAULT 0,
 pages INT UNSIGNED NOT NULL DEFAULT 0, records INT UNSIGNED NOT NULL DEFAULT 0,
 failure_code VARCHAR(80) NULL, started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME(3) NULL, actor_id BIGINT UNSIGNED NULL,
 FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sales_api_orders (
 id VARCHAR(191) COLLATE utf8mb4_bin PRIMARY KEY,
 merchant_id VARCHAR(191) NOT NULL, updated_at VARCHAR(40) NOT NULL,
 content_hash CHAR(64) NOT NULL, payload LONGTEXT NOT NULL,
 state ENUM('included','overlap','unsupported','excluded') NOT NULL,
 reason VARCHAR(80) NULL, matched_csv LONGTEXT NOT NULL,
 run_id CHAR(36) NOT NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY(run_id) REFERENCES sales_runs(id)
);
CREATE TABLE IF NOT EXISTS sales_revisions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, entity_key VARCHAR(191) NOT NULL,
 content_hash CHAR(64) NOT NULL, payload LONGTEXT NOT NULL,
 actor_id BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sales_refunds (
 id VARCHAR(191) COLLATE utf8mb4_bin PRIMARY KEY, payment_id VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 order_id VARCHAR(191) COLLATE utf8mb4_bin NULL, location_id VARCHAR(191) NOT NULL,
 status VARCHAR(40) NOT NULL, amount_cents BIGINT NOT NULL,
 created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL,
 local_date DATE NOT NULL, run_id CHAR(36) NOT NULL,
 FOREIGN KEY(run_id) REFERENCES sales_runs(id), INDEX(local_date)
);
CREATE TABLE IF NOT EXISTS source_reference_versions (
 id CHAR(64) PRIMARY KEY, source_key VARCHAR(240) NOT NULL,
 source_hash CHAR(64) NOT NULL, source_url VARCHAR(500) NOT NULL,
 title VARCHAR(255) NOT NULL, kind ENUM('recipe','ingredients','suppliers','purchases','operations','catalogue') NOT NULL,
 observed_at VARCHAR(40) NOT NULL, payload LONGTEXT NOT NULL,
 batch_id CHAR(64) NOT NULL, imported_by BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(batch_id) REFERENCES sales_batches(id), FOREIGN KEY(imported_by) REFERENCES users(id),
 UNIQUE KEY source_revision(source_key,source_hash), INDEX(kind,source_key)
);
