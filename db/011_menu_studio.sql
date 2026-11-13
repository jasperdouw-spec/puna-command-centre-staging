-- Additive menu metadata and durable media. Existing products, stock and orders are untouched.
CREATE TABLE IF NOT EXISTS menu_media (
 id CHAR(36) PRIMARY KEY, original_hash CHAR(64) NOT NULL,
 original_mime VARCHAR(40) NOT NULL, original_bytes INT UNSIGNED NOT NULL,
 width INT UNSIGNED NOT NULL, height INT UNSIGNED NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL,
 archived_at DATETIME(3) NULL, FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS menu_media_files (
 media_id CHAR(36) NOT NULL, variant VARCHAR(100) NOT NULL,
 mime VARCHAR(40) NOT NULL, sha256 CHAR(64) NOT NULL, bytes MEDIUMBLOB NOT NULL,
 public_at DATETIME(3) NULL, PRIMARY KEY(media_id,variant),
 FOREIGN KEY(media_id) REFERENCES menu_media(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS product_menu (
 product_id VARCHAR(64) PRIMARY KEY, draft LONGTEXT NULL,
 ingredients TEXT NOT NULL DEFAULT '', allergens TEXT NOT NULL DEFAULT '',
 photo_id CHAR(36) NULL, photo_crop VARCHAR(40) NOT NULL DEFAULT '50-50-100',
 photo_alt VARCHAR(240) NOT NULL DEFAULT '', variation_label VARCHAR(120) NOT NULL DEFAULT '',
 weekly BOOLEAN NOT NULL DEFAULT FALSE, oven_eligible BOOLEAN NOT NULL DEFAULT TRUE,
 starts_at DATETIME(3) NULL, ends_at DATETIME(3) NULL,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 square_candidate VARCHAR(100) NOT NULL DEFAULT '',
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(photo_id) REFERENCES menu_media(id),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS product_menu_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_id VARCHAR(64) NOT NULL,
 actor_id BIGINT UNSIGNED NULL, action VARCHAR(40) NOT NULL, snapshot LONGTEXT NOT NULL,
 created_at DATETIME(3) NOT NULL, INDEX(product_id,id),
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS menu_operations (
 operation_key CHAR(36) PRIMARY KEY, actor_id BIGINT UNSIGNED NOT NULL,
 request_hash CHAR(64) NOT NULL, result LONGTEXT NOT NULL,
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
