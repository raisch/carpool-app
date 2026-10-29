import type { RequestHandler } from '@sveltejs/kit';
import { createAdminHandler, readJson } from '#lib/server/admin-handler';
import { createRepositories } from '#lib/server/repositories';

function dependencies() {
	const repositories = createRepositories();
	return { identity: repositories.identity, admin: repositories.admin };
}

export const GET: RequestHandler = createAdminHandler(
	dependencies(),
	({ service, currentUser, params }) => service.getEvent(currentUser, params.eventId ?? '')
);

export const PATCH: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, params, request }) =>
		service.updateEvent(currentUser, params.eventId ?? '', await readJson(request))
);

export const DELETE: RequestHandler = createAdminHandler(
	dependencies(),
	({ service, currentUser, params }) => service.deleteEvent(currentUser, params.eventId ?? '')
);
