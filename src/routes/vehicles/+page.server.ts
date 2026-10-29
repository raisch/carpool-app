import type { PageServerLoad } from './$types';
import { createAdminService } from '#lib/server/services';

export const load: PageServerLoad = async ({ parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		return {
			status: 'ready' as const,
			identity,
			vehicles: await createAdminService().listVehicles(currentUser)
		};
	} catch (error) {
		return {
			status: 'error' as const,
			identity,
			message: error instanceof Error ? error.message : 'Vehicles could not be loaded.'
		};
	}
};
