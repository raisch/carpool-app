import type { RequestHandler } from '@sveltejs/kit';
import { createRepositories } from '#lib/server/repositories';
import { createPutHandler } from '#lib/server/transportation-handler';

export const PUT: RequestHandler = async (event) => {
	const repositories = createRepositories();
	return createPutHandler({
		identity: repositories.identity,
		events: repositories.events,
		transportation: repositories.transportation
	})(event);
};
