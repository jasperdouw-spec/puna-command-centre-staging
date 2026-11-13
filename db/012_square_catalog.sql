-- Additive provider cache and links. No stock, product or order is seeded/rewritten.
CREATE TABLE IF NOT EXISTS square_catalog_state (
 id TINYINT PRIMARY KEY, merchant_id VARCHAR(100) NULL, location_id VARCHAR(100) NULL,
 location_verified_at DATETIME(3) NULL, location_verified_by BIGINT UNSIGNED NULL,
 location_note VARCHAR(1000) NOT NULL DEFAULT '', pickup_address_matches BOOLEAN NOT NULL DEFAULT FALSE, locations_json LONGTEXT NULL,
 last_success_at DATETIME(3) NULL, provider_watermark VARCHAR(40) NULL, last_full_at DATETIME(3) NULL,
 failure_code VARCHAR(100) NULL, requested_at DATETIME(3) NULL,
 generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(location_verified_by) REFERENCES users(id), CHECK(id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO square_catalog_state(id) VALUES(1);
CREATE TABLE IF NOT EXISTS square_catalog_objects (
 object_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 object_type VARCHAR(30) NOT NULL, provider_version BIGINT UNSIGNED NOT NULL,
 payload LONGTEXT NOT NULL, observed_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS square_catalog_links (
 product_id VARCHAR(64) PRIMARY KEY,
 variation_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 item_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 merchant_id VARCHAR(100) NOT NULL, location_id VARCHAR(100) NOT NULL,
 status VARCHAR(80) NOT NULL DEFAULT 'verification_required',
 verified_price_cents INT UNSIGNED NULL, verified_at DATETIME(3) NULL,
 commercial_hash CHAR(64) NULL, configuration_hash CHAR(64) NULL, tax_snapshot LONGTEXT NULL,
 review_hash CHAR(64) NULL, deposit_cents INT UNSIGNED NULL,
 deposit_taxable BOOLEAN NULL, review_note VARCHAR(1000) NOT NULL DEFAULT '',
 mapped_by BIGINT UNSIGNED NOT NULL, mapped_at DATETIME(3) NOT NULL,
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(mapped_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS square_catalog_runs (
 id CHAR(36) PRIMARY KEY, mode VARCHAR(15) NOT NULL, status VARCHAR(20) NOT NULL,
 started_at DATETIME(3) NOT NULL, completed_at DATETIME(3) NULL,
 object_count INT UNSIGNED NOT NULL DEFAULT 0, failure_code VARCHAR(100) NULL,
 actor_id BIGINT UNSIGNED NULL, FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS square_catalog_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_id VARCHAR(64) NULL,
 actor_id BIGINT UNSIGNED NULL, action VARCHAR(50) NOT NULL,
 snapshot LONGTEXT NOT NULL, created_at DATETIME(3) NOT NULL,
 INDEX(product_id,id), FOREIGN KEY(product_id) REFERENCES products(id),
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS square_catalog_events (
 event_id VARCHAR(150) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 body_hash CHAR(64) NOT NULL, received_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
