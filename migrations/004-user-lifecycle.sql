DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
		ALTER TABLE users
			ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'));
	END IF;
END $$;
