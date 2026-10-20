-- Apply only to the dedicated Command Centre database after 003.
ALTER TABLE products ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1;
