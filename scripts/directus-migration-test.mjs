import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
	await readFile(path.join(root, 'migrations/001-normalized-carpool.json'), 'utf8')
);
const identityManifest = JSON.parse(
	await readFile(path.join(root, 'migrations/003-wordpress-identity.json'), 'utf8')
);
const demo = JSON.parse(
	await readFile(path.join(root, 'migrations/002-demo-carpool.json'), 'utf8')
);
const baseUrl = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');

const loginResponse = await fetch(`${baseUrl}/auth/login`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		email: process.env.DIRECTUS_ADMIN_EMAIL,
		password: process.env.DIRECTUS_ADMIN_PASSWORD
	})
});
if (!loginResponse.ok) throw new Error(`Directus login failed with HTTP ${loginResponse.status}`);
const token = (await loginResponse.json()).data.access_token;

async function get(pathname) {
	const response = await fetch(`${baseUrl}${pathname}`, {
		headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
	});
	if (!response.ok) throw new Error(`GET ${pathname} failed with HTTP ${response.status}`);
	return (await response.json()).data;
}

function psql(sql) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			'docker',
			[
				'compose',
				'exec',
				'-T',
				'postgres',
				'psql',
				'-v',
				'ON_ERROR_STOP=1',
				'-At',
				'-U',
				process.env.POSTGRES_USER ?? 'directus',
				'-d',
				process.env.POSTGRES_DB ?? 'directus'
			],
			{ cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }
		);
		let output = '';
		let error = '';
		child.stdout.on('data', (chunk) => (output += chunk));
		child.stderr.on('data', (chunk) => (error += chunk));
		child.on('error', reject);
		child.on('exit', (code) =>
			code === 0 ? resolve(output.trim()) : reject(new Error(error || `psql exited with ${code}`))
		);
		child.stdin.end(sql);
	});
}

const collections = await get('/collections');
const names = new Set(collections.map((collection) => collection.collection));
for (const collection of [
	...manifest.collections,
	{ name: identityManifest.collection, fields: identityManifest.fields }
]) {
	if (!names.has(collection.name)) throw new Error(`Missing collection ${collection.name}`);
	const fields = await get(`/fields/${collection.name}`);
	const fieldMap = new Map(fields.map((field) => [field.field, field]));
	for (const expected of collection.fields) {
		const actual = fieldMap.get(expected.field);
		if (!actual) throw new Error(`Missing field ${collection.name}.${expected.field}`);
		if (actual.type !== expected.type) {
			throw new Error(`Unexpected type for ${collection.name}.${expected.field}: ${actual.type}`);
		}
	}
}

const descriptionField = (await get('/fields/events')).find(
	(field) => field.field === 'description'
);
if (descriptionField?.meta?.interface !== 'input-multiline') {
	throw new Error(
		`events.description must use input-multiline, found ${descriptionField?.meta?.interface ?? 'none'}`
	);
}

const identityFieldNames = new Set((await get('/fields/users')).map((field) => field.field));
for (const field of identityManifest.fields) {
	if (!identityFieldNames.has(field.field)) {
		throw new Error(`Missing WordPress identity field users.${field.field}`);
	}
}

const demoIdentity = await get(
	'/items/users/9001?fields=id,source_system,source_uid,first_name,last_name,email,telephone'
);
if (demoIdentity.source_system !== 'local' || String(demoIdentity.source_uid) !== '9001') {
	throw new Error('Existing demo identity was not namespaced for migration');
}

const legacyNames = ['event', 'destination_trip', 'return_trip', 'ride', 'rider', 'event_trips'];
for (const legacyName of legacyNames) {
	if (names.has(legacyName)) throw new Error(`Legacy collection retained: ${legacyName}`);
}

const events = await get(
	'/items/events?limit=1&fields=id,status,name,description,start_date,end_date,location'
);
if (!Array.isArray(events)) throw new Error('Events collection did not return a list');

const demoUserIds = demo.users.map((user) => user.id).join(',');
const demoUsers = await get(
	`/items/users?filter[id][_in]=${demoUserIds}&fields=id,display_name,role,status&limit=3`
);
for (const user of demo.users) {
	const actual = demoUsers.find((record) => String(record.id) === String(user.id));
	if (
		!actual ||
		actual.display_name !== user.displayName ||
		actual.role !== user.role ||
		actual.status !== user.status
	) {
		throw new Error(`Demo user ${user.id} does not match migration data`);
	}
}

const demoEvents = await get(
	`/items/events/${demo.event.id}?fields=id,status,name,description,start_date,end_date,location`
);
if (
	String(demoEvents.id) !== String(demo.event.id) ||
	demoEvents.status !== demo.event.status ||
	demoEvents.name !== demo.event.name
) {
	throw new Error('Demo event does not match migration data');
}

const demoOutbound = await get(`/items/outbound_trips/${demo.trips.outbound.id}`);
const demoReturn = await get(`/items/return_trips/${demo.trips.return.id}`);
if (
	String(demoOutbound.event_id) !== String(demo.event.id) ||
	String(demoReturn.event_id) !== String(demo.event.id) ||
	demoOutbound.status !== 'published' ||
	demoReturn.status !== 'published'
) {
	throw new Error('Demo outbound/return trips do not match migration data');
}

const demoVehicles = await get(`/items/vehicles/${demo.vehicle.id}`);
if (
	demoVehicles.status !== demo.vehicle.status ||
	demoVehicles.name !== demo.vehicle.name ||
	String(demoVehicles.primary_driver_id) !== String(demo.vehicle.primaryDriverId)
) {
	throw new Error('Demo vehicle does not match migration data');
}

const demoRides = await get(
	`/items/trip_rides?filter[id][_in]=${demo.tripRides.map((ride) => ride.id).join(',')}&fields=id,trip_id,vehicle_id&limit=2`
);
for (const ride of demo.tripRides) {
	const actual = demoRides.find((record) => String(record.id) === String(ride.id));
	if (
		!actual ||
		String(actual.trip_id) !== String(ride.tripId) ||
		String(actual.vehicle_id) !== String(ride.vehicleId)
	) {
		throw new Error(`Demo trip ride ${ride.id} does not match migration data`);
	}
}

const demoRiders = await get(
	`/items/trip_ride_riders?filter[user_id][_eq]=${demo.rider.userId}&fields=id,trip_ride_id,user_id&limit=2`
);
for (const tripRideId of demo.rider.tripRideIds) {
	if (
		!demoRiders.some(
			(record) =>
				String(record.trip_ride_id) === String(tripRideId) &&
				String(record.user_id) === String(demo.rider.userId)
		)
	) {
		throw new Error(`Missing demo migration record: rider assignment (${tripRideId})`);
	}
}

const demoDecisions = await get(
	`/items/transportation_decisions?filter[event_id][_eq]=${demo.event.id}&filter[user_id][_eq]=${demo.rider.userId}&fields=id,direction,decision,trip_ride_id&limit=2`
);
if (
	demoDecisions.length !== 2 ||
	!demoDecisions.some(
		(decision) => decision.direction === 'outbound' && String(decision.trip_ride_id) === '9001'
	) ||
	!demoDecisions.some(
		(decision) => decision.direction === 'return' && String(decision.trip_ride_id) === '9002'
	)
) {
	throw new Error('Demo transportation decisions do not match migration data');
}

const expectedConstraints = [
	'events_date_order_check',
	'events_status_check',
	'outbound_trips_status_check',
	'return_trips_status_check',
	'transportation_decisions_decision_check',
	'transportation_decisions_direction_check',
	'transportation_decisions_ride_reference_check',
	'users_status_check',
	'users_role_check',
	'vehicles_seats_check',
	'vehicles_status_check'
];
const constraints = (
	await psql(
		`SELECT conname FROM pg_constraint WHERE conname IN (${expectedConstraints.map((name) => `'${name}'`).join(',')}) ORDER BY conname;`
	)
)
	.split('\n')
	.filter(Boolean);
if (constraints.join('|') !== [...expectedConstraints].sort().join('|')) {
	throw new Error(`PostgreSQL constraints are incomplete: ${constraints.join(', ')}`);
}

const expectedIndexes = [
	'trip_ride_riders_ride_user_unique',
	'trip_rides_trip_vehicle_unique',
	'transportation_decisions_event_user_direction_unique',
	'users_source_identity_unique'
];
const indexes = (
	await psql(
		`SELECT indexname FROM pg_indexes WHERE indexname IN (${expectedIndexes.map((name) => `'${name}'`).join(',')}) ORDER BY indexname;`
	)
)
	.split('\n')
	.filter(Boolean);
if (indexes.join('|') !== [...expectedIndexes].sort().join('|')) {
	throw new Error(`PostgreSQL unique indexes are incomplete: ${indexes.join(', ')}`);
}

const identityColumns = (
	await psql(
		`SELECT column_name || ':' || is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('source_system', 'source_uid') ORDER BY column_name;`
	)
)
	.split('\n')
	.filter(Boolean);
if (identityColumns.join('|') !== 'source_system:NO|source_uid:NO') {
	throw new Error(`WordPress identity columns are not required: ${identityColumns.join(', ')}`);
}

await psql(`
DO $$
BEGIN
	BEGIN
		INSERT INTO events (status, name, start_date, end_date, location)
		VALUES ('invalid', 'constraint test', DATE '2026-01-02', DATE '2026-01-01', 'test');
		RAISE EXCEPTION 'events checks did not reject invalid data';
	EXCEPTION WHEN check_violation THEN NULL;
	END;
	BEGIN
		INSERT INTO users (display_name, role, status, source_system, source_uid)
		VALUES ('constraint test', 'invalid', 'active', 'local', 'constraint-test');
		RAISE EXCEPTION 'users role check did not reject invalid data';
	EXCEPTION WHEN check_violation THEN NULL;
	END;
	BEGIN
		INSERT INTO users (display_name, role, status, source_system, source_uid)
		VALUES ('constraint test', 'rider', 'pending', 'local', 'constraint-status-test');
		RAISE EXCEPTION 'users status check did not reject invalid data';
	EXCEPTION WHEN check_violation THEN NULL;
	END;
END $$;
`);

console.log(
	`verified ${manifest.version}, ${demo.version}, ${identityManifest.version}, and 004-user-lifecycle: ${manifest.collections.length} collections, normalized event reads, WordPress identity fields, user lifecycle constraints, PostgreSQL constraints, and a complete demo carpool`
);
