import { describe, expect, it } from 'vitest';
import { CARPOOL_COLLECTIONS } from '../collections';
import { ConstrainedDirectusClient, DirectusBoundaryError } from './client';

function clientFor(
	fetch: typeof globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }))
): ConstrainedDirectusClient {
	return new ConstrainedDirectusClient({
		baseUrl: 'https://directus.example.test',
		token: 'server-only-test-token',
		fetch
	});
}

describe('ConstrainedDirectusClient', () => {
	it('uses normalized collections, explicit fields, and server authorization', async () => {
		let request: Request | undefined;
		const client = clientFor(async (input, init) => {
			request = new Request(input, init);
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});

		await client.readItems(CARPOOL_COLLECTIONS.events, {
			fields: ['id', 'name'],
			filters: [{ field: 'status', operator: '_eq', value: 'published' }]
		});

		expect(request?.url).toContain('/items/events');
		expect(request?.url).toContain('fields=id%2Cname');
		expect(request?.url).toContain('filter%5Bstatus%5D%5B_eq%5D=published');
		expect(request?.headers.get('authorization')).toBe('Bearer server-only-test-token');
	});

	it('rejects CMS collections and restricted user fields before making a request', async () => {
		const fetch = async () => {
			throw new Error('the request should not be made');
		};
		const client = clientFor(fetch);

		await expect(client.readItems('pages' as never)).rejects.toBeInstanceOf(DirectusBoundaryError);
		await expect(
			client.readItems(CARPOOL_COLLECTIONS.users, { fields: ['password'] })
		).rejects.toThrow('Field password is not allowed for users');
		await expect(
			client.readItems(CARPOOL_COLLECTIONS.users, { fields: ['email_address'] })
		).rejects.toThrow('Field email_address is not allowed for users');
		await expect(
			client.createItem(CARPOOL_COLLECTIONS.users, { display_name: 'Nope' })
		).rejects.toThrow('Writes to users are not allowed');
		await expect(client.readItems('pages' as never)).rejects.toThrow(
			'Collection pages is not allowed'
		);
	});

	it('updates only the role and status through the restricted user boundary', async () => {
		let request: Request | undefined;
		const client = clientFor(async (input, init) => {
			request = new Request(input, init);
			return new Response(
				JSON.stringify({ data: { id: 'user-1', role: 'driver', status: 'active' } })
			);
		});

		await client.updateCarpoolUser('user-1', { role: 'driver', status: 'active' });

		expect(request?.method).toBe('PATCH');
		expect(new URL(request?.url ?? '').pathname).toBe('/items/users/user-1');
		expect(await request?.json()).toEqual({ role: 'driver', status: 'active' });
	});

	it('rejects filters and sorts outside the field allowlist', async () => {
		const client = clientFor();

		await expect(
			client.readItems(CARPOOL_COLLECTIONS.events, {
				filters: [{ field: 'password', operator: '_eq', value: 'secret' }]
			})
		).rejects.toThrow('Filter field password is not allowed for events');
		await expect(
			client.readItems(CARPOOL_COLLECTIONS.events, { sort: ['created_at'] })
		).rejects.toThrow('Sort field created_at is not allowed for events');
	});

	it('sends transportation changes through one atomic server endpoint', async () => {
		let request: Request | undefined;
		const client = clientFor(async (input, init) => {
			request = new Request(input, init);
			return new Response(null, { status: 204 });
		});

		await client.replaceTransportation('event-1', 'member-1', {
			outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
			return: { decision: 'opt_out', tripRideId: null },
			expectedUpdatedAt: null
		});

		expect(request?.method).toBe('PUT');
		expect(new URL(request?.url ?? '').pathname).toBe('/carpool/transportation');
		expect(await request?.json()).toMatchObject({
			eventId: 'event-1',
			userId: 'member-1',
			outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
			return: { decision: 'opt_out', tripRideId: null }
		});
	});

	it('provisions WordPress identities without exposing general user writes', async () => {
		const requests: Request[] = [];
		const client = clientFor(async (input, init) => {
			const request = new Request(input, init);
			requests.push(request);
			if (request.method === 'GET') return new Response(JSON.stringify({ data: [] }));
			return new Response(
				JSON.stringify({
					data: {
						id: 'user-1',
						role: 'rider',
						status: 'active',
						display_name: 'First Last'
					}
				})
			);
		});

		await expect(
			client.upsertWordPressUser({
				sourceSystem: 'wordpress',
				sourceUid: 'wp-1',
				firstName: 'First',
				lastName: 'Last',
				email: 'first.last@example.test',
				telephone: null
			})
		).resolves.toEqual({ id: 'user-1', role: 'rider', status: 'active' });

		expect(requests).toHaveLength(2);
		expect(requests[0].url).toContain('filter%5Bsource_system%5D%5B_eq%5D=wordpress');
		expect(requests[0].url).toContain('filter%5Bsource_uid%5D%5B_eq%5D=wp-1');
		expect(requests[1].method).toBe('POST');
		expect(await requests[1].json()).toEqual({
			display_name: 'First Last',
			source_system: 'wordpress',
			source_uid: 'wp-1',
			first_name: 'First',
			last_name: 'Last',
			email: 'first.last@example.test',
			telephone: null,
			role: 'rider',
			status: 'active'
		});
	});

	it('refreshes a deactivated identity without reactivating it', async () => {
		const requests: Request[] = [];
		const client = clientFor(async (input, init) => {
			const request = new Request(input, init);
			requests.push(request);
			if (request.method === 'GET') {
				return new Response(
					JSON.stringify({ data: [{ id: 'user-1', role: 'rider', status: 'inactive' }] })
				);
			}
			return new Response(
				JSON.stringify({ data: { id: 'user-1', role: 'rider', status: 'inactive' } })
			);
		});

		await expect(
			client.upsertWordPressUser({
				sourceSystem: 'wordpress',
				sourceUid: 'wp-1',
				firstName: 'First',
				lastName: 'Last',
				email: 'first.last@example.test',
				telephone: null
			})
		).resolves.toEqual({ id: 'user-1', role: 'rider', status: 'inactive' });
		expect(requests[1].method).toBe('PATCH');
		expect(await requests[1].json()).toEqual({
			display_name: 'First Last',
			source_system: 'wordpress',
			source_uid: 'wp-1',
			first_name: 'First',
			last_name: 'Last',
			email: 'first.last@example.test',
			telephone: null
		});
	});
});
