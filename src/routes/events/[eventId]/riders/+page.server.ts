import type { PageServerLoad } from './$types';
import { BackendUnavailableError } from '#lib/server/errors';
import { createExportService } from '#lib/server/services';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		const event = await createExportService().getEvent(currentUser, params.eventId ?? '');
		return { status: 'ready' as const, identity, event };
	} catch (error) {
		console.error('Unable to load carpool rider print view', {
			name: error instanceof Error ? error.name : 'UnknownError',
			eventId: params.eventId
		});
		return {
			status: 'error' as const,
			identity,
			message:
				error instanceof BackendUnavailableError
					? 'The carpool backend is unavailable. Please try again.'
					: error instanceof Error
						? error.message
						: 'The rider list could not be loaded.'
		};
	}
};
