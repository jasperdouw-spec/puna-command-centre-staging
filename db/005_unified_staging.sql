-- PROPOSAL: new isolated staging database only, after schema inspection and approval.
-- Never run this against either backed-up database. No data migration is performed.
CREATE TABLE IF NOT EXISTS website_settings (
 id VARCHAR(64) PRIMARY KEY,value LONGTEXT NOT NULL,version INT UNSIGNED NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS test_orders (
 id CHAR(36) PRIMARY KEY,created_by BIGINT UNSIGNED NOT NULL,customer VARCHAR(80) NOT NULL,
 slot VARCHAR(40) NOT NULL,items LONGTEXT NOT NULL,total INT UNSIGNED NOT NULL,
 status ENUM('New','Preparing','Ready','Collected','Cancelled') NOT NULL DEFAULT 'New',
 version INT UNSIGNED NOT NULL DEFAULT 1,is_test BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES users(id),INDEX(status,created_at),CHECK(is_test=1)
);
