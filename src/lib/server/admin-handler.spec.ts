import { describe, expect, it } from 'vitest';
import type { IdentityProvider } from './identity';
import type { AdminRepository } from './repositories/contracts';
import { createAdminHandler } from './admin-handler';

const repository = {} as AdminRepository;

function request(): Parameters<ReturnType<typeof createAdminHandler>>[0] {
	return {
		params: {},
		url: new URL('http://localhost/api/events'),
		request: new Request('http://localhost/api/events', { method: 'GET' })
	} as Parameters<ReturnType<typeof createAdminHandler>>[0];
}

describe('administrative route authorization', () => {
	it('returns 403 before invoking an admin action for a rider', async () => {
		const identity: IdentityProvider = {
			async getCurrentUser() {
				return {
					status: 'configured',
					currentUser: { id: 'rider-1', displayName: 'Rider', role: 'rider' }
				};
			}
		};
		const handler = createAdminHandler(
			{ identity, admin: repository },
			async ({ service, currentUser }) => service.listEvents(currentUser)
		);
		const response = await handler(request());
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ error: { code: 'forbidden' } });
	});
});
