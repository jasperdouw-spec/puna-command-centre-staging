-- PROVISIONAL, UNNUMBERED Phase C candidate. Disposable synthetic databases ONLY.
-- No alteration of legacy inventory, checkout, orders, reporting or collection.
CREATE TABLE IF NOT EXISTS kitchen_state (
 id TINYINT UNSIGNED PRIMARY KEY,
 mode ENUM('open','paused','closed') NOT NULL DEFAULT 'closed',
 version INT UNSIGNED NOT NULL DEFAULT 1,
 reviewed_at DATETIME(3) NULL, heartbeat_at DATETIME(3) NULL, heartbeat_client CHAR(36) NULL,
 heartbeat_actor BIGINT UNSIGNED NULL,
 hold_seconds INT UNSIGNED NOT NULL DEFAULT 300,
 FOREIGN KEY(heartbeat_actor) REFERENCES users(id),
 CHECK(id=1), CHECK(hold_seconds BETWEEN 60 AND 900)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_observations (
 client_id CHAR(36) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 read_version INT UNSIGNED NOT NULL, read_at DATETIME(3) NOT NULL,
 PRIMARY KEY(client_id,actor_id), FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_lots (
 id CHAR(36) PRIMARY KEY, product_id VARCHAR(64) NOT NULL,
 started_units INT UNSIGNED NOT NULL, started_at DATETIME(3) NOT NULL,
 estimated_ready_at DATETIME(3) NOT NULL,
 online_ready INT UNSIGNED NOT NULL DEFAULT 0, truck_ready INT UNSIGNED NOT NULL DEFAULT 0,
 online_baking INT UNSIGNED NOT NULL DEFAULT 0, truck_baking INT UNSIGNED NOT NULL DEFAULT 0,
 version INT UNSIGNED NOT NULL DEFAULT 1, note VARCHAR(500) NOT NULL DEFAULT '',
 created_by BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(created_by) REFERENCES users(id),
 INDEX(product_id,started_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_allocations (
 id CHAR(36) PRIMARY KEY, channel ENUM('online','truck') NOT NULL,
 state ENUM('unpaid','pending','uncertain','paid','counter_pending','released','consumed','late_exception') NOT NULL,
 synthetic BOOLEAN NOT NULL DEFAULT FALSE,
 label VARCHAR(80) NOT NULL, pickup_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(created_by) REFERENCES users(id), INDEX(state,expires_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_allocation_lines (
 allocation_id CHAR(36) NOT NULL, lot_id CHAR(36) NOT NULL,
 quantity INT UNSIGNED NOT NULL, ready_units INT UNSIGNED NOT NULL DEFAULT 0,
 set_aside_units INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(allocation_id,lot_id), FOREIGN KEY(allocation_id) REFERENCES kitchen_allocations(id),
 FOREIGN KEY(lot_id) REFERENCES kitchen_lots(id),
 CHECK(quantity>0), CHECK(ready_units<=quantity), CHECK(set_aside_units<=ready_units)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kitchen_events (
 operation_key CHAR(36) PRIMARY KEY, actor_id BIGINT UNSIGNED NOT NULL,
 request_hash CHAR(64) NOT NULL, kind VARCHAR(40) NOT NULL,
 result LONGTEXT NOT NULL, details LONGTEXT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 FOREIGN KEY(actor_id) REFERENCES users(id), INDEX(created_at)
) ENGINE=InnoDB;
INSERT INTO kitchen_state(id) VALUES(1);
