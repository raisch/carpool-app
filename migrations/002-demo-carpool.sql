BEGIN;

INSERT INTO users (id, display_name, role, status, source_system, source_uid)
VALUES
	(9001, 'Demo Admin', 'admin', 'active', 'local', '9001'),
	(9002, 'Demo Driver', 'driver', 'active', 'local', '9002'),
	(9003, 'Demo Rider', 'rider', 'active', 'local', '9003')
ON CONFLICT (id) DO UPDATE SET
	display_name = EXCLUDED.display_name,
	role = EXCLUDED.role,
	status = EXCLUDED.status,
	source_system = EXCLUDED.source_system,
	source_uid = EXCLUDED.source_uid;

INSERT INTO events (id, status, name, description, start_date, end_date, location)
VALUES (
	9001,
	'published',
	'Demo Carpool',
	'A complete local carpool seeded for development.',
	DATE '2026-11-10',
	DATE '2026-11-12',
	'Boston'
)
ON CONFLICT (id) DO UPDATE SET
	status = EXCLUDED.status,
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	start_date = EXCLUDED.start_date,
	end_date = EXCLUDED.end_date,
	location = EXCLUDED.location;

INSERT INTO outbound_trips (
	id, event_id, status, destination, departs_from, departs_on, departs_at, arrives_at
)
VALUES (9001, 9001, 'published', 'Boston', 'Waltham', DATE '2026-11-10', TIME '08:00', TIME '09:00')
ON CONFLICT (id) DO UPDATE SET
	event_id = EXCLUDED.event_id,
	status = EXCLUDED.status,
	destination = EXCLUDED.destination,
	departs_from = EXCLUDED.departs_from,
	departs_on = EXCLUDED.departs_on,
	departs_at = EXCLUDED.departs_at,
	arrives_at = EXCLUDED.arrives_at;

INSERT INTO return_trips (
	id, event_id, status, destination, departs_from, departs_on, departs_at, arrives_at
)
VALUES (9002, 9001, 'published', 'Waltham', 'Boston', DATE '2026-11-12', TIME '17:00', TIME '18:00')
ON CONFLICT (id) DO UPDATE SET
	event_id = EXCLUDED.event_id,
	status = EXCLUDED.status,
	destination = EXCLUDED.destination,
	departs_from = EXCLUDED.departs_from,
	departs_on = EXCLUDED.departs_on,
	departs_at = EXCLUDED.departs_at,
	arrives_at = EXCLUDED.arrives_at;

INSERT INTO vehicles (id, status, name, vehicle_type, seats, primary_driver_id)
VALUES (9001, 'published', 'Demo Van', 'Van', 4, 9002)
ON CONFLICT (id) DO UPDATE SET
	status = EXCLUDED.status,
	name = EXCLUDED.name,
	vehicle_type = EXCLUDED.vehicle_type,
	seats = EXCLUDED.seats,
	primary_driver_id = EXCLUDED.primary_driver_id;

INSERT INTO trip_rides (id, trip_id, vehicle_id)
VALUES (9001, 9001, 9001), (9002, 9002, 9001)
ON CONFLICT (id) DO UPDATE SET
	trip_id = EXCLUDED.trip_id,
	vehicle_id = EXCLUDED.vehicle_id;

INSERT INTO trip_ride_riders (id, trip_ride_id, user_id)
VALUES (9001, 9001, 9003), (9002, 9002, 9003)
ON CONFLICT (trip_ride_id, user_id) DO NOTHING;

INSERT INTO transportation_decisions (
	id, event_id, user_id, direction, decision, trip_ride_id, updated_at
)
VALUES
	(9001, 9001, 9003, 'outbound', 'ride', 9001, CURRENT_TIMESTAMP),
	(9002, 9001, 9003, 'return', 'ride', 9002, CURRENT_TIMESTAMP)
ON CONFLICT (event_id, user_id, direction) DO UPDATE SET
	decision = EXCLUDED.decision,
	trip_ride_id = EXCLUDED.trip_ride_id,
	updated_at = EXCLUDED.updated_at;

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 9003), true);
SELECT setval(pg_get_serial_sequence('events', 'id'), GREATEST((SELECT MAX(id) FROM events), 9001), true);
SELECT setval(pg_get_serial_sequence('outbound_trips', 'id'), GREATEST((SELECT MAX(id) FROM outbound_trips), 9001), true);
SELECT setval(pg_get_serial_sequence('return_trips', 'id'), GREATEST((SELECT MAX(id) FROM return_trips), 9002), true);
SELECT setval(pg_get_serial_sequence('vehicles', 'id'), GREATEST((SELECT MAX(id) FROM vehicles), 9001), true);
SELECT setval(pg_get_serial_sequence('trip_rides', 'id'), GREATEST((SELECT MAX(id) FROM trip_rides), 9002), true);
SELECT setval(pg_get_serial_sequence('trip_ride_riders', 'id'), GREATEST((SELECT MAX(id) FROM trip_ride_riders), 9002), true);
SELECT setval(pg_get_serial_sequence('transportation_decisions', 'id'), GREATEST((SELECT MAX(id) FROM transportation_decisions), 9002), true);

COMMIT;
