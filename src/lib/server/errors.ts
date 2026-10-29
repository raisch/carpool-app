export class BackendUnavailableError extends Error {
	readonly code = 'backend_unavailable';
	readonly status: number = 502;

	constructor(message = 'The carpool backend is unavailable') {
		super(message);
		this.name = 'BackendUnavailableError';
	}
}

export class ResourceNotFoundError extends Error {
	readonly code = 'not_found';
	readonly status = 404;

	constructor(resource: string) {
		super(`${resource} was not found`);
		this.name = 'ResourceNotFoundError';
	}
}

export class IdentityUnavailableError extends Error {
	readonly code = 'identity_unavailable';
	readonly status = 401;

	constructor(message = 'A connected team-member identity is required for this action.') {
		super(message);
		this.name = 'IdentityUnavailableError';
	}
}

export class ValidationError extends Error {
	readonly code = 'invalid_request';
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

export class AuthorizationError extends Error {
	readonly code = 'forbidden';
	readonly status = 403;

	constructor(message = 'You do not have permission to perform this action.') {
		super(message);
		this.name = 'AuthorizationError';
	}
}

export class ConflictError extends Error {
	readonly code = 'conflict';
	readonly status = 409;

	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

export class TransportationConflictError extends Error {
	readonly code = 'transportation_conflict';
	readonly status = 409;

	constructor(message: string) {
		super(message);
		this.name = 'TransportationConflictError';
	}
}
