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

export const GET: RequestHandler = createAdminHandler(dependencies(), ({ service, currentUser }) =>
	service.listVehicles(currentUser)
);

export const POST: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, request }) =>
		service.createVehicle(currentUser, await readJson(request))
);

export const PATCH: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, request }) => {
		const payload = objectPayload(await readJson(request));
		const vehicleId = identifier(payload.id);
		const input = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'id'));
		return service.updateVehicle(currentUser, vehicleId, input);
	}
);

export const DELETE: RequestHandler = createAdminHandler(
	dependencies(),
	({ service, currentUser, url }) =>
		service.deleteVehicle(currentUser, url.searchParams.get('id') ?? '')
);
