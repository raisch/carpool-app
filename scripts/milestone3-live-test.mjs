import { spawn } from 'node:child_process';

const root = process.cwd();
const directusUrl = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const appUrl = 'http://127.0.0.1:4174';
let appProcess;
const created = {
	users: [],
	events: [],
	trips: [],
	vehicles: [],
	tripRides: []
};

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
	const { response, body } = await directus(`/items/${collection}`, {
		method: 'POST',
		body: JSON.stringify(value)
	});
	if (!response.ok) throw new Error(`Unable to create ${collection}: HTTP ${response.status}`);
	return body.data;
}

async function remove(collection, id) {
	if (id === undefined || id === null) return;
	await directus(`/items/${collection}/${id}`, { method: 'DELETE' });
}

async function waitForApp() {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			const response = await fetch(`${appUrl}/`);
			if (response.ok) return;
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
		headers: { Accept: 'application/json', ...(options.headers ?? {}) }
	});
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = { raw: text };
	}
	return { response, body, text };
}

try {
	const suffix = Date.now();
	const member = await create('users', {
		display_name: `Milestone 3 member ${suffix}`,
		role: 'rider',
		status: 'active'
	});
	const secondMember = await create('users', {
		display_name: `Milestone 3 second member ${suffix}`,
		role: 'rider',
		status: 'active'
	});
	const driver = await create('users', {
		display_name: `Milestone 3 driver ${suffix}`,
		role: 'driver',
		status: 'active'
	});
	created.users.push(member.id, secondMember.id, driver.id);

	const event = await create('events', {
		status: 'published',
		name: `Milestone 3 live event ${suffix}`,
		description: 'Temporary live workflow fixture',
		start_date: '2026-11-10',
		end_date: '2026-11-12',
		location: 'Boston'
	});
	created.events.push(event.id);
	const trip = await create('outbound_trips', {
		event_id: event.id,
		status: 'published',
		destination: 'Boston',
		departs_from: 'Waltham',
		departs_on: '2026-11-10',
		departs_at: '08:00',
		arrives_at: '09:00'
	});
	created.trips.push(trip.id);
	const vehicle = await create('vehicles', {
		status: 'published',
		name: `Milestone 3 one-seat vehicle ${suffix}`,
		vehicle_type: 'Car',
		seats: 1,
		primary_driver_id: driver.id
	});
	created.vehicles.push(vehicle.id);
	const tripRide = await create('trip_rides', { trip_id: trip.id, vehicle_id: vehicle.id });
	created.tripRides.push(tripRide.id);

	appProcess = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4174'], {
		cwd: root,
		stdio: 'ignore',
		env: {
			...process.env,
			DIRECTUS_TOKEN: token,
			CARPOOL_DEV_USER_ID: String(member.id),
			CARPOOL_DEV_USER_NAME: member.display_name,
			CARPOOL_DEV_USER_ROLE: 'rider'
		}
	});
	await waitForApp();

	const page = await appRequest(`/events/${event.id}`);
	if (!page.response.ok || !page.text.includes(event.name)) {
		throw new Error('The event page did not load the live Directus fixture');
	}

	const payload = {
		outbound: { decision: 'ride', tripRideId: String(tripRide.id) },
		return: { decision: 'opt_out', tripRideId: null },
		expectedUpdatedAt: null
	};
	const saved = await appRequest(`/api/events/${event.id}/transportation`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (saved.response.status !== 200 || saved.body?.status?.outbound?.decision !== 'ride') {
		throw new Error(`Live transportation save failed with HTTP ${saved.response.status}`);
	}

	const savedDecision = saved.body.status.outbound;
	const decisions = await directus(
		`/items/transportation_decisions?filter[event_id][_eq]=${event.id}&filter[user_id][_eq]=${member.id}`
	);
	const riders = await directus(
		`/items/trip_ride_riders?filter[trip_ride_id][_eq]=${tripRide.id}&filter[user_id][_eq]=${member.id}`
	);
	if (decisions.body.data?.length !== 2 || riders.body.data?.length !== 1) {
		throw new Error('Live Directus state did not contain both decisions and one rider assignment');
	}

	const stale = await appRequest(`/api/events/${event.id}/transportation`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (stale.response.status !== 409) throw new Error('Stale live update was not rejected with 409');

	const full = await directus('/carpool/transportation', {
		method: 'PUT',
		body: JSON.stringify({
			eventId: event.id,
			userId: secondMember.id,
			outbound: { decision: 'ride', tripRideId: tripRide.id },
			return: { decision: 'opt_out', tripRideId: null },
			expectedUpdatedAt: null
		})
	});
	if (full.response.status !== 409) throw new Error('Full live vehicle was not rejected with 409');
	const secondDecisions = await directus(
		`/items/transportation_decisions?filter[event_id][_eq]=${event.id}&filter[user_id][_eq]=${secondMember.id}`
	);
	if (secondDecisions.body.data?.length !== 0) {
		throw new Error('Full vehicle conflict left partial transportation decisions');
	}

	const cleared = await appRequest(`/api/events/${event.id}/transportation`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			outbound: { decision: 'opt_out', tripRideId: null },
			return: { decision: 'opt_out', tripRideId: null },
			expectedUpdatedAt: savedDecision.updatedAt
		})
	});
	if (cleared.response.status !== 200 || cleared.body?.status?.outbound?.decision !== 'opt_out') {
		throw new Error('Live transportation clear/update failed');
	}
	const clearedRiders = await directus(
		`/items/trip_ride_riders?filter[trip_ride_id][_eq]=${tripRide.id}&filter[user_id][_eq]=${member.id}`
	);
	if (clearedRiders.body.data?.length !== 0)
		throw new Error('Clearing left an orphaned rider assignment');

	console.log(
		'verified milestone 3 live app route, atomic Directus write, stale conflict, full conflict, and clear'
	);
} finally {
	if (appProcess) appProcess.kill('SIGTERM');
	for (const id of created.tripRides.reverse()) await remove('trip_rides', id);
	for (const id of created.trips.reverse()) await remove('outbound_trips', id);
	for (const id of created.vehicles.reverse()) await remove('vehicles', id);
	for (const id of created.events.reverse()) await remove('events', id);
	for (const id of created.users.reverse()) await remove('users', id);
}
