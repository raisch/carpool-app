import { spawn } from 'node:child_process';

const root = process.cwd();
const directusUrl = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const appUrl = 'http://127.0.0.1:4175';
const created = {
	users: [],
	events: [],
	outboundTrips: [],
	returnTrips: [],
	vehicles: [],
	tripRides: []
};
let appProcess;

async function login() {
	const response = await fetch(`${directusUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: process.env.DIRECTUS_ADMIN_EMAIL,
			password: process.env.DIRECTUS_ADMIN_PASSWORD
		})
	});
	if (!response.ok) throw new Error(`Directus login failed with HTTP ${response.status}`);
	return (await response.json()).data.access_token;
}

const token = await login();

async function directus(pathname, options = {}) {
	const response = await fetch(`${directusUrl}${pathname}`, {
		...options,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${token}`,
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers ?? {})
		}
	});
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = { raw: text };
	}
	return { response, body };
}

async function create(collection, value) {
	const result = await directus(`/items/${collection}`, {
		method: 'POST',
		body: JSON.stringify(value)
	});
	if (!result.response.ok)
		throw new Error(`Unable to create ${collection}: HTTP ${result.response.status}`);
	return result.body.data;
}

async function remove(collection, id) {
	if (id === undefined || id === null) return;
	await directus(`/items/${collection}/${id}`, { method: 'DELETE' });
}

async function stopApp() {
	if (!appProcess) return;
	appProcess.kill('SIGTERM');
	await new Promise((resolve) => appProcess.once('exit', resolve));
	appProcess = undefined;
}

async function startApp(user, role) {
	await stopApp();
	appProcess = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4175'], {
		cwd: root,
		stdio: 'ignore',
		env: {
			...process.env,
			DIRECTUS_TOKEN: token,
			CARPOOL_DEV_USER_ID: String(user.id),
			CARPOOL_DEV_USER_NAME: user.display_name,
			CARPOOL_DEV_USER_ROLE: role
		}
	});
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			if ((await fetch(`${appUrl}/`)).ok) return;
		} catch {
			// The preview server is still starting.
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error('SvelteKit preview server did not start');
}

async function appRequest(pathname, options = {}) {
	const response = await fetch(`${appUrl}${pathname}`, {
		...options,
		headers: { Accept: 'application/json', Origin: appUrl, ...(options.headers ?? {}) }
	});
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = { raw: text };
	}
	return { response, body };
}

function assertStatus(result, status, message) {
	if (result.response.status !== status) {
		throw new Error(
			`${message}: expected HTTP ${status}, got ${result.response.status}: ${JSON.stringify(result.body)}`
		);
	}
}

try {
	const suffix = Date.now();
	const admin = await create('users', {
		display_name: `Milestone 4 admin ${suffix}`,
		role: 'admin',
		status: 'active'
	});
	const driver = await create('users', {
		display_name: `Milestone 4 driver ${suffix}`,
		role: 'driver',
		status: 'active'
	});
	const otherDriver = await create('users', {
		display_name: `Milestone 4 other driver ${suffix}`,
		role: 'driver',
		status: 'active'
	});
	const rider = await create('users', {
		display_name: `Milestone 4 rider ${suffix}`,
		role: 'rider',
		status: 'active'
	});
	created.users.push(admin.id, driver.id, otherDriver.id, rider.id);

	const event = await create('events', {
		status: 'published',
		name: `Milestone 4 event ${suffix}`,
		description: 'Temporary administrative fixture',
		start_date: '2026-12-01',
		end_date: '2026-12-02',
		location: 'Boston'
	});
	created.events.push(event.id);
	const trip = await create('outbound_trips', {
		event_id: event.id,
		status: 'published',
		destination: 'Boston',
		departs_from: 'Waltham',
		departs_on: '2026-12-01',
		departs_at: '08:00',
		arrives_at: '09:00'
	});
	created.outboundTrips.push(trip.id);
	const vehicle = await create('vehicles', {
		status: 'published',
		name: `Milestone 4 vehicle ${suffix}`,
		vehicle_type: 'Van',
		seats: 2,
		primary_driver_id: driver.id
	});
	created.vehicles.push(vehicle.id);
	const otherVehicle = await create('vehicles', {
		status: 'published',
		name: `Milestone 4 other vehicle ${suffix}`,
		vehicle_type: 'Car',
		seats: 2,
		primary_driver_id: otherDriver.id
	});
	created.vehicles.push(otherVehicle.id);

	await startApp(admin, 'admin');
	const createdEvent = await appRequest('/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			status: 'draft',
			name: `Temporary event ${suffix}`,
			description: null,
			startDate: '2026-12-03',
			endDate: '2026-12-03',
			location: 'Boston'
		})
	});
	assertStatus(createdEvent, 200, 'admin event creation');
	await appRequest(`/api/events/${createdEvent.body.data.id}`, { method: 'DELETE' });

	const patchedEvent = await appRequest(`/api/events/${event.id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			status: 'published',
			name: event.name,
			description: event.description,
			startDate: event.start_date,
			endDate: event.end_date,
			location: event.location
		})
	});
	assertStatus(patchedEvent, 200, 'admin event update');

	const createdTrip = await appRequest('/api/trips', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			eventId: event.id,
			direction: 'return',
			status: 'draft',
			destination: 'Waltham',
			departsFrom: 'Boston',
			departsOn: '2026-12-02',
			departsAt: '17:00',
			arrivesAt: null
		})
	});
	assertStatus(createdTrip, 200, 'admin trip creation');
	created.returnTrips.push(createdTrip.body.data.id);
	await appRequest(`${'/api/trips'}?id=${createdTrip.body.data.id}`, { method: 'DELETE' });

	const assignment = await appRequest('/api/trips', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tripId: trip.id, vehicleId: vehicle.id })
	});
	assertStatus(assignment, 200, 'admin vehicle assignment');
	const tripRideId = assignment.body.data.id;
	created.tripRides.push(tripRideId);

	const added = await appRequest(`/api/trip-rides/${tripRideId}/riders`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId: rider.id })
	});
	assertStatus(added, 200, 'admin rider add');
	await startApp(driver, 'driver');
	assertStatus(await appRequest('/api/events'), 403, 'driver global event access');
	const visibleVehicles = await appRequest('/api/vehicles');
	assertStatus(visibleVehicles, 200, 'driver vehicle list');
	if (
		visibleVehicles.body.data.length !== 1 ||
		String(visibleVehicles.body.data[0].vehicle.id) !== String(vehicle.id)
	) {
		throw new Error('Driver vehicle list was not scoped to the owned vehicle');
	}
	const ownUpdate = await appRequest('/api/vehicles', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: vehicle.id,
			status: 'published',
			name: `Updated ${suffix}`,
			vehicleType: 'Van',
			seats: 2,
			primaryDriverId: driver.id
		})
	});
	assertStatus(ownUpdate, 200, 'driver own vehicle update');
	const outOfScope = await appRequest('/api/vehicles', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: otherVehicle.id,
			status: 'published',
			name: 'Nope',
			vehicleType: 'Car',
			seats: 2,
			primaryDriverId: otherDriver.id
		})
	});
	assertStatus(outOfScope, 403, 'driver out-of-scope vehicle update');
	const driverAssignment = await appRequest('/api/trips', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tripId: trip.id, vehicleId: otherVehicle.id })
	});
	assertStatus(driverAssignment, 403, 'driver assignment access');

	const removed = await appRequest(`/api/trip-rides/${tripRideId}/riders`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId: rider.id })
	});
	assertStatus(removed, 200, 'driver own rider removal');
	await startApp(admin, 'admin');
	const unassigned = await appRequest(`${'/api/trips'}?tripRideId=${tripRideId}`, {
		method: 'DELETE'
	});
	assertStatus(unassigned, 200, 'admin assignment cleanup');

	console.log(
		'verified milestone 4 live admin CRUD, driver scoping, assignment authorization, and rider cleanup'
	);
} finally {
	await stopApp();
	for (const id of created.tripRides.reverse()) await remove('trip_rides', id);
	for (const id of created.outboundTrips.reverse()) await remove('outbound_trips', id);
	for (const id of created.returnTrips.reverse()) await remove('return_trips', id);
	for (const id of created.vehicles.reverse()) await remove('vehicles', id);
	for (const id of created.events.reverse()) await remove('events', id);
	for (const id of created.users.reverse()) await remove('users', id);
}
