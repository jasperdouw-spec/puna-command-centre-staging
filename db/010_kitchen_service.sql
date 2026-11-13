-- Persistent service metadata only; no stock, order or audit resets.
-- Apply after verified migration 009 and a retained application/database checkpoint.
-- Existing legacy Open is NOT converted to a verified business session.
CREATE TABLE IF NOT EXISTS kitchen_service (
 id TINYINT UNSIGNED PRIMARY KEY,
 session_opened_at DATETIME(3) NULL,
 session_closes_at DATETIME(3) NULL,
 review_due_at DATETIME(3) NULL,
 confidence ENUM('unreviewed','verified','blocked') NOT NULL DEFAULT 'unreviewed',
 confidence_reason VARCHAR(240) NULL,
 review_minutes INT UNSIGNED NOT NULL DEFAULT 480,
 prep_minutes INT UNSIGNED NOT NULL DEFAULT 10,
 window_minutes INT UNSIGNED NOT NULL DEFAULT 15,
 capacity_orders INT UNSIGNED NOT NULL DEFAULT 6,
 capacity_units INT UNSIGNED NOT NULL DEFAULT 60,
 FOREIGN KEY(id) REFERENCES kitchen_state(id),
 CHECK(id=1), CHECK(review_minutes BETWEEN 60 AND 720),
 CHECK(prep_minutes BETWEEN 5 AND 60), CHECK(window_minutes BETWEEN 5 AND 60),
 CHECK(capacity_orders BETWEEN 1 AND 100), CHECK(capacity_units BETWEEN 1 AND 500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO kitchen_service(id) VALUES(1);
CREATE TABLE IF NOT EXISTS kitchen_pickup_schedule (
 order_id CHAR(36) PRIMARY KEY,
 original_start DATETIME(3) NOT NULL,
 expected_start DATETIME(3) NOT NULL,
 expected_end DATETIME(3) NOT NULL,
 needs_review BOOLEAN NOT NULL DEFAULT FALSE,
 reason VARCHAR(240) NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES pickup_orders(id),
 INDEX(needs_review,expected_start), CHECK(expected_end>expected_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
