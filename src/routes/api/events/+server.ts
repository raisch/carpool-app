import type { RequestHandler } from '@sveltejs/kit';
import { createRepositories } from '#lib/server/repositories';
import { createAdminHandler, readJson } from '#lib/server/admin-handler';

export const GET: RequestHandler = createAdminHandler(
	{ identity: createRepositories().identity, admin: createRepositories().admin },
	({ service, currentUser }) => service.listEvents(currentUser)
);

export const POST: RequestHandler = createAdminHandler(
	{ identity: createRepositories().identity, admin: createRepositories().admin },
	async ({ service, currentUser, request }) =>
		service.createEvent(currentUser, await readJson(request))
);
