import { json, type RequestHandler } from '@sveltejs/kit';
import { DtoValidationError } from '#lib/domain/validation';
import {
	BackendUnavailableError,
	IdentityUnavailableError,
	ResourceNotFoundError,
	TransportationConflictError
} from '#lib/server/errors';
import type { IdentityProvider } from '#lib/server/identity';
import type { EventRepository, TransportationRepository } from '#lib/server/repositories/contracts';
import { TransportationService } from '#lib/server/services/transportation-service';

export interface TransportationHandlerDependencies {
	identity: IdentityProvider;
	events: EventRepository;
	transportation: TransportationRepository;
}

function errorResponse(error: unknown): Response {
	if (
		error instanceof DtoValidationError ||
		error instanceof IdentityUnavailableError ||
		error instanceof ResourceNotFoundError ||
		error instanceof TransportationConflictError ||
		error instanceof BackendUnavailableError
	) {
		return json(
			{ error: { code: error.code, message: error.message } },
			{ status: error.status, headers: { 'cache-control': 'no-store' } }
		);
	}

	console.error('Unable to save transportation status', {
		name: error instanceof Error ? error.name : 'UnknownError'
	});
	return json(
		{ error: { code: 'unexpected_error', message: 'Transportation status could not be saved.' } },
		{ status: 500, headers: { 'cache-control': 'no-store' } }
	);
}

export function createPutHandler(dependencies: TransportationHandlerDependencies): RequestHandler {
	const service = new TransportationService(dependencies.events, dependencies.transportation);

	return async (event) => {
		let payload: unknown;
		try {
			payload = await event.request.json();
		} catch {
			return errorResponse(new DtoValidationError('Request body must be valid JSON'));
		}

		try {
			const identity = event.locals?.identity ?? (await dependencies.identity.getCurrentUser());
			const currentUser = identity.status === 'configured' ? identity.currentUser : null;
			if (!event.params.eventId) throw new DtoValidationError('eventId is required');
			const status = await service.replaceCurrent(event.params.eventId, currentUser, payload);
			return json({ status }, { headers: { 'cache-control': 'no-store' } });
		} catch (error) {
			return errorResponse(error);
		}
	};
}
