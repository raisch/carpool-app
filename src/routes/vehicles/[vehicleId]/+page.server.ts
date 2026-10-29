import type { PageServerLoad } from './$types';
import { createAdminService } from '#lib/server/services';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		return {
			status: 'ready' as const,
			identity,
			vehicle: await createAdminService().getVehicle(currentUser, params.vehicleId)
		};
	} catch (error) {
		return {
			status: 'error' as const,
			identity,
			message: error instanceof Error ? error.message : 'Vehicle could not be loaded.'
		};
	}
};
