import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const directusUrl = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const appUrl = 'http://127.0.0.1:4175';
const created = { users: [], events: [], trips: [], vehicles: [], tripRides: [] };
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

function assertStatus(response, status, message) {
	if (response.status !== status)
		throw new Error(`${message}: expected HTTP ${status}, got ${response.status}`);
}

async function appResponse(pathname, headers = {}) {
	return fetch(`${appUrl}${pathname}`, {
		headers: { Accept: 'application/json', Origin: appUrl, ...headers }
	});
}

try {
	const suffix = Date.now();
	const admin = await create('users', {
		display_name: `Milestone 5 admin ${suffix}`,
		role: 'admin',
		status: 'active'
	});
	const driver = await create('users', {
		display_name: `Milestone 5 driver ${suffix}`,
		role: 'driver',
		status: 'active'
	});
	const otherDriver = await create('users', {
		display_name: `Milestone 5 other driver ${suffix}`,
		role: 'driver',
		status: 'active'
	});
	const rider = await create('users', {
		display_name: `Milestone 5 rider ${suffix}`,
		role: 'rider',
		status: 'active'
	});
	const otherRider = await create('users', {
		display_name: `Milestone 5 other rider ${suffix}`,
		role: 'rider',
		status: 'active'
	});
	created.users.push(admin.id, driver.id, otherDriver.id, rider.id, otherRider.id);

	const event = await create('events', {
		status: 'published',
		name: `Milestone 5 event ${suffix}`,
		description: 'Temporary export fixture',
		start_date: '2026-12-01',
		end_date: '2026-12-02',
		location: 'Boston'
	});
	const otherEvent = await create('events', {
		status: 'published',
		name: `Milestone 5 other event ${suffix}`,
		description: null,
		start_date: '2026-12-03',
		end_date: '2026-12-03',
		location: 'Waltham'
	});
	created.events.push(event.id, otherEvent.id);

	const outbound = await create('outbound_trips', {
		event_id: event.id,
		status: 'published',
		destination: 'Boston',
		departs_from: 'Waltham',
		departs_on: '2026-12-01',
		departs_at: '08:00',
		arrives_at: '09:00'
	});
	const returning = await create('return_trips', {
		event_id: event.id,
		status: 'published',
		destination: 'Waltham',
		departs_from: 'Boston',
		departs_on: '2026-12-02',
		departs_at: '17:00',
		arrives_at: '18:00'
	});
	const otherTrip = await create('outbound_trips', {
		event_id: otherEvent.id,
		status: 'published',
		destination: 'Waltham',
		departs_from: 'Boston',
		departs_on: '2026-12-03',
		departs_at: '08:00',
		arrives_at: '09:00'
	});
	created.trips.push(
		['outbound_trips', outbound.id],
		['return_trips', returning.id],
		['outbound_trips', otherTrip.id]
	);

	const vehicle = await create('vehicles', {
		status: 'published',
		name: `Milestone 5 vehicle ${suffix}`,
		vehicle_type: 'Van',
		seats: 4,
		primary_driver_id: driver.id
	});
	const otherVehicle = await create('vehicles', {
		status: 'published',
		name: `Milestone 5 other vehicle ${suffix}`,
		vehicle_type: 'Car',
		seats: 4,
		primary_driver_id: otherDriver.id
	});
	created.vehicles.push(vehicle.id, otherVehicle.id);

	const outboundRide = await create('trip_rides', { trip_id: outbound.id, vehicle_id: vehicle.id });
	const returnRide = await create('trip_rides', { trip_id: returning.id, vehicle_id: vehicle.id });
	const otherRide = await create('trip_rides', {
		trip_id: otherTrip.id,
		vehicle_id: otherVehicle.id
	});
	created.tripRides.push(outboundRide.id, returnRide.id, otherRide.id);
	await create('trip_ride_riders', { trip_ride_id: outboundRide.id, user_id: rider.id });
	await create('trip_ride_riders', { trip_ride_id: returnRide.id, user_id: rider.id });
	await create('trip_ride_riders', { trip_ride_id: otherRide.id, user_id: otherRider.id });

	await startApp(admin, 'admin');
	const csvResponse = await appResponse(`/events/${event.id}/export`, { Accept: 'text/csv' });
	assertStatus(csvResponse, 200, 'admin CSV export');
	const csv = await csvResponse.text();
	if (!csvResponse.headers.get('content-type')?.startsWith('text/csv'))
		throw new Error('CSV content type missing');
	if (csvResponse.headers.get('cache-control') !== 'no-store')
		throw new Error('CSV must not be cached');
	if (!csv.includes(`Milestone 5 event ${suffix}`) || !csv.includes(`Milestone 5 rider ${suffix}`))
		throw new Error('CSV omitted requested event rider data');
	if (
		csv.includes(`Milestone 5 other event ${suffix}`) ||
		csv.includes(`Milestone 5 other rider ${suffix}`)
	)
		throw new Error('CSV was not event-scoped');
	if (/email|phone/i.test(csv)) throw new Error('CSV contains restricted contact fields');

	const printResponse = await appResponse(`/events/${event.id}/riders`, { Accept: 'text/html' });
	const printHtml = await printResponse.text();
	if (printResponse.status !== 200)
		throw new Error(
			`admin print view: expected HTTP 200, got ${printResponse.status}: ${printHtml}`
		);
	if (
		!printHtml.includes(`Milestone 5 event ${suffix}`) ||
		!printHtml.includes(`Milestone 5 rider ${suffix}`)
	)
		throw new Error('Print view omitted requested event rider data');
	if (!printHtml.includes('Carpool rider list')) throw new Error('Print view heading missing');

	await startApp(rider, 'rider');
	const forbiddenExport = await appResponse(`/events/${event.id}/export`, { Accept: 'text/csv' });
	assertStatus(forbiddenExport, 403, 'rider CSV export rejection');
	const forbiddenPrint = await appResponse(`/events/${event.id}/riders`, { Accept: 'text/html' });
	assertStatus(forbiddenPrint, 200, 'rider print boundary');
	if ((await forbiddenPrint.text()).includes(`Milestone 5 event ${suffix}`))
		throw new Error('Rider print boundary leaked event data');

	const clientOutputRoots = ['.svelte-kit/output/client', 'build/client'];
	for (const relative of clientOutputRoots) {
		try {
			await readdir(path.join(root, relative));
		} catch {
			continue;
		}
		const result = await new Promise((resolve, reject) => {
			const child = spawn('rg', ['-F', '-l', token, path.join(root, relative)], {
				stdio: ['ignore', 'pipe', 'pipe']
			});
			let output = '';
			child.stdout.on('data', (chunk) => (output += chunk));
			child.on('error', reject);
			child.on('exit', (code) => resolve({ code, output }));
		});
		if (result.code === 0)
			throw new Error(`Directus token found in client output: ${result.output}`);
	}

	console.log(
		'verified milestone 5 event-scoped export, print boundary, accessibility shell, and client token boundary'
	);
} finally {
	await stopApp();
	for (const id of created.tripRides.reverse()) await remove('trip_rides', id);
	for (const [collection, id] of created.trips.reverse()) await remove(collection, id);
	for (const id of created.vehicles.reverse()) await remove('vehicles', id);
	for (const id of created.events.reverse()) await remove('events', id);
	for (const id of created.users.reverse()) await remove('users', id);
}
