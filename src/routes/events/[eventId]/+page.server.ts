import type { PageServerLoad } from './$types';
import { BackendUnavailableError } from '#lib/server/errors';
import { createEventService } from '#lib/server/services';

export const load: PageServerLoad = async ({ params, parent }) => {
	try {
		const { identity } = await parent();
		const currentUser = identity.status === 'configured' ? identity.currentUser : null;
		const details = await createEventService().getPublishedEvent(params.eventId, currentUser);

		if (!details) {
			return { status: 'not-found' as const, eventId: params.eventId };
		}

		return { status: 'ready' as const, eventId: params.eventId, details };
	} catch (error) {
		if (error instanceof BackendUnavailableError) {
			return { status: 'error' as const, eventId: params.eventId, message: error.message };
		}

		console.error(`Unable to load carpool event ${params.eventId}`, error);
		return {
			status: 'error' as const,
			eventId: params.eventId,
			message: 'This carpool event could not be loaded. Please try again.'
		};
	}
};
