import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '#lib/domain/types';
import { MemorySessionStore, type SessionConfig } from './session';

const config: SessionConfig = {
	cookieName: 'carpool_session',
	idleTimeoutSeconds: 30,
	absoluteTimeoutSeconds: 120,
	secure: false
};
const user: CurrentUser = { id: 'user-1', displayName: 'First Last', role: 'rider' };

describe('carpool sessions', () => {
	it('creates a server-only token and resolves the current user', () => {
		const store = new MemorySessionStore(config);
		const token = store.create(user, 1_000);

		expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
		expect(store.get(token, 1_001)).toEqual(user);
	});

	it('expires idle sessions and enforces the absolute lifetime', () => {
		const store = new MemorySessionStore(config);
		const token = store.create(user, 1_000);

		expect(store.get(token, 30_999)).toEqual(user);
		expect(store.get(token, 61_000)).toBeNull();

		const absoluteToken = store.create(user, 1_000);
		expect(store.get(absoluteToken, 121_001)).toBeNull();
	});

	it('revokes a session immediately', () => {
		const store = new MemorySessionStore(config);
		const token = store.create(user, 1_000);

		store.revoke(token);
		expect(store.get(token, 1_001)).toBeNull();
	});

	it('updates roles for existing sessions and invalidates deactivated users', () => {
		const store = new MemorySessionStore(config);
		const token = store.create(user, 1_000);

		store.updateUser({ ...user, role: 'driver' });
		expect(store.get(token, 1_001)?.role).toBe('driver');

		store.invalidateUser(user.id);
		expect(store.get(token, 1_002)).toBeNull();
	});
});
