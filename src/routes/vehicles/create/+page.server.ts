import type { PageServerLoad } from './$types';
import { createAdminService } from '#lib/server/services';

export const load: PageServerLoad = async ({ parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		return {
			status: 'ready' as const,
			identity,
			drivers: await createAdminService().listDrivers(currentUser)
		};
	} catch (error) {
		return {
			status: 'error' as const,
			identity,
			message: error instanceof Error ? error.message : 'Drivers could not be loaded.'
		};
	}
};
