import type { RequestHandler } from '@sveltejs/kit';
import { createAdminHandler, readJson } from '#lib/server/admin-handler';
import { createRepositories } from '#lib/server/repositories';

function dependencies() {
	const repositories = createRepositories();
	return { identity: repositories.identity, admin: repositories.admin };
}

function objectPayload(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
	return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value))
		? String(value)
		: '';
}

export const POST: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, request }) => {
		const payload = objectPayload(await readJson(request));
		const tripId = identifier(payload.tripId);
		const vehicleId = identifier(payload.vehicleId);
		if (tripId && vehicleId) {
			return service.assignVehicle(currentUser, tripId, vehicleId);
		}
		return service.createTrip(currentUser, payload);
	}
);

export const PATCH: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, request }) => {
		const payload = objectPayload(await readJson(request));
		const tripId = identifier(payload.id);
		const input = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'id'));
		return service.updateTrip(currentUser, tripId, input);
	}
);

export const DELETE: RequestHandler = createAdminHandler(
	dependencies(),
	({ service, currentUser, url }) =>
		url.searchParams.has('tripRideId')
			? service.unassignVehicle(currentUser, url.searchParams.get('tripRideId') ?? '')
			: service.deleteTrip(currentUser, url.searchParams.get('id') ?? '')
);
