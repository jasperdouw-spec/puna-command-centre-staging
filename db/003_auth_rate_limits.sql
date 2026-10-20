-- Apply only to the dedicated Puna database after 001_initial.sql.
CREATE TABLE IF NOT EXISTS auth_attempts (identifier CHAR(64) PRIMARY KEY, attempts INT UNSIGNED NOT NULL DEFAULT 0, blocked_until DATETIME NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
