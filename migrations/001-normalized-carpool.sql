DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_status_check') THEN
		ALTER TABLE events
			ADD CONSTRAINT events_status_check CHECK (status IN ('draft', 'published', 'archived'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_date_order_check') THEN
		ALTER TABLE events
			ADD CONSTRAINT events_date_order_check CHECK (start_date <= end_date);
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbound_trips_status_check') THEN
		ALTER TABLE outbound_trips
			ADD CONSTRAINT outbound_trips_status_check CHECK (status IN ('draft', 'published', 'archived'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'return_trips_status_check') THEN
		ALTER TABLE return_trips
			ADD CONSTRAINT return_trips_status_check CHECK (status IN ('draft', 'published', 'archived'));
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_status_check') THEN
		ALTER TABLE vehicles
			ADD CONSTRAINT vehicles_status_check CHECK (status IN ('draft', 'published', 'archived'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_seats_check') THEN
		ALTER TABLE vehicles
			ADD CONSTRAINT vehicles_seats_check CHECK (seats > 0);
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transportation_decisions_direction_check') THEN
		ALTER TABLE transportation_decisions
			ADD CONSTRAINT transportation_decisions_direction_check CHECK (direction IN ('outbound', 'return'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transportation_decisions_decision_check') THEN
		ALTER TABLE transportation_decisions
			ADD CONSTRAINT transportation_decisions_decision_check CHECK (decision IN ('ride', 'opt_out'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transportation_decisions_ride_reference_check') THEN
		ALTER TABLE transportation_decisions
			ADD CONSTRAINT transportation_decisions_ride_reference_check CHECK (
				(decision = 'ride' AND trip_ride_id IS NOT NULL)
				OR (decision = 'opt_out' AND trip_ride_id IS NULL)
			);
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
		ALTER TABLE users
			ADD CONSTRAINT users_role_check CHECK (role IN ('rider', 'driver', 'admin'));
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS trip_rides_trip_vehicle_unique
	ON trip_rides (trip_id, vehicle_id);

CREATE UNIQUE INDEX IF NOT EXISTS trip_ride_riders_ride_user_unique
	ON trip_ride_riders (trip_ride_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS transportation_decisions_event_user_direction_unique
	ON transportation_decisions (event_id, user_id, direction);
