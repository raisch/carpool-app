import type { PageServerLoad } from './$types';
import { createEventService } from '#lib/server/services';
import { BackendUnavailableError } from '#lib/server/errors';

export const load: PageServerLoad = async ({ url, locals }) => {
	const launchStatus = url.searchParams.get('launch') === 'invalid' ? ('invalid' as const) : null;
	if (locals.identity.status !== 'configured') {
		return { status: 'ready' as const, events: [], launchStatus };
	}

	try {
		return {
			status: 'ready' as const,
			events: await createEventService().listActiveEvents(),
			launchStatus
		};
	} catch (error) {
		if (error instanceof BackendUnavailableError) {
			return { status: 'error' as const, message: error.message, launchStatus };
		}

		console.error('Unable to load active carpool events', error);
		return {
			status: 'error' as const,
			message: 'Active carpool events could not be loaded. Please try again.',
			launchStatus
		};
	}
};
