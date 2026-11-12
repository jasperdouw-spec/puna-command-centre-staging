-- Additive candidate: apply only after exact schema inspection and verified backup.
-- Empty mappings: real catalog IDs and counted opening stock are never invented.
CREATE TABLE kitchen_square_mappings (
 variation_id VARCHAR(192) PRIMARY KEY, product_id VARCHAR(64) NOT NULL,
 units INT UNSIGNED NOT NULL DEFAULT 1, verified_at DATETIME(3) NOT NULL,
 verified_by BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(verified_by) REFERENCES users(id),
 CHECK(units BETWEEN 1 AND 1000)
) ENGINE=InnoDB;
CREATE TABLE kitchen_pos_orders (
 square_order_id VARCHAR(192) PRIMARY KEY, provider_version BIGINT UNSIGNED NOT NULL,
 quantities LONGTEXT NOT NULL, applied_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE kitchen_pos_events (
 event_id VARCHAR(192) PRIMARY KEY, square_order_id VARCHAR(192) NOT NULL,
 outcome VARCHAR(80) NOT NULL, received_at DATETIME(3) NOT NULL,
 INDEX(square_order_id)
) ENGINE=InnoDB;
CREATE TABLE kitchen_pos_issues (
 id CHAR(36) PRIMARY KEY, square_order_id VARCHAR(192) NOT NULL,
 code VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL,
 resolved_at DATETIME(3) NULL, resolved_by BIGINT UNSIGNED NULL,
 FOREIGN KEY(resolved_by) REFERENCES users(id), INDEX(resolved_at)
) ENGINE=InnoDB;
