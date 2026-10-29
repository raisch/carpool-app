import type { RequestHandler } from '@sveltejs/kit';
import { createAdminHandler, readJson } from '#lib/server/admin-handler';
import { createRepositories } from '#lib/server/repositories';

function dependencies() {
	const repositories = createRepositories();
	return { identity: repositories.identity, admin: repositories.admin };
}

export const POST: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, params, request }) =>
		service.addRider(currentUser, params.tripRideId ?? '', await readJson(request))
);

export const DELETE: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, params, request }) =>
		service.removeRider(currentUser, params.tripRideId ?? '', await readJson(request))
);

export const PATCH: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, params, request }) =>
		service.moveRider(currentUser, params.tripRideId ?? '', await readJson(request))
);
