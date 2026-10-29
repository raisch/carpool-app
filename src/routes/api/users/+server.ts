import type { RequestHandler } from '@sveltejs/kit';
import { createAdminHandler, readJson } from '#lib/server/admin-handler';
import { createRepositories } from '#lib/server/repositories';
import { defaultSessionStore } from '#lib/server/session';

function dependencies() {
	const repositories = createRepositories();
	return { identity: repositories.identity, admin: repositories.admin };
}

function objectPayload(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
	return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value))
		? String(value)
		: '';
}

export const GET: RequestHandler = createAdminHandler(dependencies(), ({ service, currentUser }) =>
	service.listUsers(currentUser)
);

export const PATCH: RequestHandler = createAdminHandler(
	dependencies(),
	async ({ service, currentUser, request }) => {
		const payload = objectPayload(await readJson(request));
		const userId = identifier(payload.id);
		const input = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'id'));
		const updated = await service.updateUser(currentUser, userId, input);

		if (updated.status === 'inactive') defaultSessionStore.invalidateUser(updated.id);
		else defaultSessionStore.updateUser(updated);

		return updated;
	}
);
