import type { PageServerLoad } from './$types';
import { completeEventPrintData } from '#lib/domain/export';
import { BackendUnavailableError } from '#lib/server/errors';
import { createExportService } from '#lib/server/services';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { identity } = await parent();
	const currentUser = identity.status === 'configured' ? identity.currentUser : null;
	try {
		const event = await createExportService().getEvent(currentUser, params.eventId);
		return { status: 'ready' as const, report: completeEventPrintData(event) };
	} catch (error) {
		console.error(`Unable to load complete event print report ${params.eventId}`, error);
		return {
			status: 'error' as const,
			message:
				error instanceof BackendUnavailableError
					? 'The carpool backend is unavailable. Please try again.'
					: error instanceof Error
						? error.message
						: 'The event report could not be loaded.'
		};
	}
};
