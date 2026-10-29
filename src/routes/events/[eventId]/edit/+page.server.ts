import type { PageServerLoad } from './$types';
import { createAdminService } from '#lib/server/services';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		const service = createAdminService();
		const details = await service.getEvent(currentUser, params.eventId);
		const vehicles = await service.listVehicles(currentUser);
		return { status: 'ready' as const, identity, details, vehicles };
	} catch (error) {
		console.error(`Unable to load event administration ${params.eventId}`, error);
		return {
			status: 'error' as const,
			identity,
			message: error instanceof Error ? error.message : 'Event administration could not be loaded.'
		};
	}
};
