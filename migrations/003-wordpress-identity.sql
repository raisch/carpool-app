BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS source_system VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS source_uid VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(320);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telephone VARCHAR(40);

-- Existing local/demo identities are namespaced separately from WordPress.
UPDATE users
SET source_system = COALESCE(source_system, 'local'),
	source_uid = COALESCE(source_uid, id::text)
WHERE source_system IS NULL OR source_uid IS NULL;

ALTER TABLE users ALTER COLUMN source_system SET NOT NULL;
ALTER TABLE users ALTER COLUMN source_uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_source_identity_unique
	ON users (source_system, source_uid);

COMMIT;
