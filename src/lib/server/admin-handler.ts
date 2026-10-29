import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { DtoValidationError } from '#lib/domain/validation';
import {
	AuthorizationError,
	BackendUnavailableError,
	ConflictError,
	IdentityUnavailableError,
	ResourceNotFoundError,
	ValidationError
} from './errors';
import type { IdentityProvider } from './identity';
import { AdminService } from './services/admin-service';
import type { AdminRepository } from './repositories/contracts';

export interface AdminHandlerDependencies {
	identity: IdentityProvider;
	admin: AdminRepository;
}

type AdminAction = (context: {
	service: AdminService;
	currentUser: import('./identity').CurrentUser | null;
	params: RequestEvent['params'];
	request: Request;
	url: URL;
}) => Promise<unknown>;

function errorResponse(error: unknown): Response {
	if (
		error instanceof DtoValidationError ||
		error instanceof ValidationError ||
		error instanceof AuthorizationError ||
		error instanceof IdentityUnavailableError ||
		error instanceof ResourceNotFoundError ||
		error instanceof ConflictError ||
		error instanceof BackendUnavailableError
	) {
		return json(
			{ error: { code: error.code, message: error.message } },
			{ status: error.status, headers: { 'cache-control': 'no-store' } }
		);
	}
	console.error('Unable to complete administrative carpool operation', {
		name: error instanceof Error ? error.name : 'UnknownError'
	});
	return json(
		{ error: { code: 'unexpected_error', message: 'The administrative operation failed.' } },
		{ status: 500, headers: { 'cache-control': 'no-store' } }
	);
}

export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new DtoValidationError('Request body must be valid JSON');
	}
}

export function createAdminHandler(
	dependencies: AdminHandlerDependencies,
	action: AdminAction
): RequestHandler {
	const service = new AdminService(dependencies.admin);
	return async (event) => {
		try {
			const identity = event.locals?.identity ?? (await dependencies.identity.getCurrentUser());
			const currentUser = identity.status === 'configured' ? identity.currentUser : null;
			const data = await action({
				service,
				currentUser,
				params: event.params,
				request: event.request,
				url: event.url
			});
			return data === undefined
				? json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
				: json({ data }, { headers: { 'cache-control': 'no-store' } });
		} catch (error) {
			return errorResponse(error);
		}
	};
}
