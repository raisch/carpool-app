import type { RequestHandler } from '@sveltejs/kit';
import { eventRiderCsv } from '#lib/domain/export';
import {
	AuthorizationError,
	BackendUnavailableError,
	IdentityUnavailableError,
	ResourceNotFoundError
} from '#lib/server/errors';
import { createRepositories } from '#lib/server/repositories';
import { createExportService } from '#lib/server/services';

function errorResponse(error: unknown): Response {
	if (
		error instanceof AuthorizationError ||
		error instanceof BackendUnavailableError ||
		error instanceof IdentityUnavailableError ||
		error instanceof ResourceNotFoundError
	) {
		return Response.json(
			{ error: { code: error.code, message: error.message } },
			{ status: error.status, headers: { 'cache-control': 'no-store' } }
		);
	}
	console.error('Unable to export carpool riders', {
		name: error instanceof Error ? error.name : 'UnknownError'
	});
	return Response.json(
		{ error: { code: 'unexpected_error', message: 'The rider export could not be generated.' } },
		{ status: 500, headers: { 'cache-control': 'no-store' } }
	);
}

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const repositories = createRepositories();
		const identity = locals.identity ?? (await repositories.identity.getCurrentUser());
		const currentUser = identity.status === 'configured' ? identity.currentUser : null;
		const event = await createExportService().getEvent(currentUser, params.eventId ?? '');
		return new Response(eventRiderCsv(event), {
			headers: {
				'cache-control': 'no-store',
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="carpool-event-${params.eventId}-riders.csv"`
			}
		});
	} catch (error) {
		return errorResponse(error);
	}
};
