import type { PageServerLoad } from './$types';
import { createAdminService } from '#lib/server/services';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		const service = createAdminService();
		return {
			status: 'ready' as const,
			identity,
			vehicle: await service.getVehicle(currentUser, params.vehicleId),
			drivers: currentUser?.role === 'admin' ? await service.listDrivers(currentUser) : [],
			riders: await service.listRiders(currentUser)
		};
	} catch (error) {
		return {
			status: 'error' as const,
			identity,
			message:
				error instanceof Error ? error.message : 'Vehicle administration could not be loaded.'
		};
	}
};
