import { describe, expect, it } from 'vitest';
import { CARPOOL_COLLECTIONS } from '../collections';
import type { DirectusClient, DirectusReadQuery } from '../directus/client';
import type { CurrentUser } from '../identity';
import { DirectusEventRepository, createDirectusRepositories } from './directus';

type Fixture = Record<string, unknown[]>;

class FixtureDirectusClient implements DirectusClient {
	readonly calls: Array<{ collection: string; query: DirectusReadQuery }> = [];

	constructor(private readonly fixture: Fixture) {}

	async readItems(collection: keyof Fixture, query: DirectusReadQuery = {}): Promise<unknown[]> {
		this.calls.push({ collection, query });
		return (this.fixture[collection] ?? []).filter((item) => {
			if (typeof item !== 'object' || item === null) return false;
			return (query.filters ?? []).every((filter) => {
				const actual = String((item as Record<string, unknown>)[filter.field]);
				return filter.operator === '_eq'
					? actual === filter.value
					: Array.isArray(filter.value) && filter.value.map(String).includes(actual);
			});
		});
	}

	async replaceTransportation(): Promise<void> {
		return;
	}

	async createItem(): Promise<unknown> {
		return {};
	}

	async updateItem(): Promise<unknown> {
		return {};
	}

	async deleteItem(): Promise<void> {
		return;
	}

	async updateCarpoolUser(): Promise<unknown> {
		return { id: 'user-1', display_name: 'User One', role: 'rider', status: 'active' };
	}

	async upsertWordPressUser(): Promise<{ id: string; role: 'rider'; status: 'active' }> {
		return { id: 'provisioned-user', role: 'rider', status: 'active' };
	}
}

const currentUser: CurrentUser = { id: 'member-1', displayName: 'Member One', role: 'rider' };

function fixture(): Fixture {
	return {
		[CARPOOL_COLLECTIONS.events]: [
			{
				id: 'event-1',
				status: 'published',
				name: 'Regional Championship',
				description: 'Team travel',
				start_date: '2026-11-10',
				end_date: '2026-11-12',
				location: 'Boston'
			},
			{
				id: 'draft-event',
				status: 'draft',
				name: 'Draft event',
				description: null,
				start_date: '2026-12-01',
				end_date: '2026-12-01',
				location: 'Boston'
			},
			{
				id: 'archived-event',
				status: 'archived',
				name: 'Archived event',
				description: null,
				start_date: '2026-09-01',
				end_date: '2026-09-01',
				location: 'Boston'
			}
		],
		[CARPOOL_COLLECTIONS.outboundTrips]: [
			{
				id: 'outbound-1',
				event_id: 'event-1',
				status: 'published',
				destination: 'Boston',
				departs_from: 'Waltham',
				departs_on: '2026-11-10',
				departs_at: '08:00',
				arrives_at: '09:00'
			}
		],
		[CARPOOL_COLLECTIONS.returnTrips]: [
			{
				id: 'return-1',
				event_id: 'event-1',
				status: 'published',
				destination: 'Waltham',
				departs_from: 'Boston',
				departs_on: '2026-11-12',
				departs_at: '17:00',
				arrives_at: '18:00'
			}
		],
		[CARPOOL_COLLECTIONS.vehicles]: [
			{
				id: 'vehicle-1',
				status: 'published',
				name: 'Blue van',
				vehicle_type: 'Van',
				seats: 4,
				primary_driver_id: 'driver-1'
			},
			{
				id: 'vehicle-2',
				status: 'published',
				name: 'Green car',
				vehicle_type: 'Car',
				seats: 3,
				primary_driver_id: 'driver-2'
			}
		],
		[CARPOOL_COLLECTIONS.tripRides]: [
			{ id: 'ride-1', trip_id: 'outbound-1', vehicle_id: 'vehicle-1' },
			{ id: 'ride-2', trip_id: 'return-1', vehicle_id: 'vehicle-2' }
		],
		[CARPOOL_COLLECTIONS.tripRideRiders]: [
			{ id: 'rider-record-1', trip_ride_id: 'ride-1', user_id: 'member-1' },
			{ id: 'rider-record-2', trip_ride_id: 'ride-1', user_id: 'rider-2' }
		],
		[CARPOOL_COLLECTIONS.transportationDecisions]: [
			{
				id: 'decision-1',
				event_id: 'event-1',
				user_id: 'member-1',
				direction: 'outbound',
				decision: 'ride',
				trip_ride_id: 'ride-1',
				updated_at: '2026-10-29T12:00:00Z'
			}
		],
		[CARPOOL_COLLECTIONS.users]: [
			{ id: 'member-1', display_name: 'Member One', role: 'rider', status: 'active' },
			{ id: 'rider-2', display_name: 'Rider Two', role: 'rider', status: 'active' },
			{ id: 'driver-1', display_name: 'Driver One', role: 'driver', status: 'active' },
			{ id: 'driver-2', display_name: 'Driver Two', role: 'driver', status: 'active' }
		]
	};
}

describe('normalized Directus repositories', () => {
	it('filters lifecycle state and returns an event-scoped normalized aggregate', async () => {
		const client = new FixtureDirectusClient(fixture());
		const repository = new DirectusEventRepository(client);

		await expect(repository.listPublished()).resolves.toHaveLength(1);
		const details = await repository.getPublishedDetails('event-1', currentUser);

		expect(details?.event.id).toBe('event-1');
		expect(details?.outbound.trip?.direction).toBe('outbound');
		expect(details?.return.trip?.direction).toBe('return');
		expect(details?.outbound.rides[0]).toMatchObject({
			id: 'ride-1',
			occupiedSeats: 2,
			remainingSeats: 2,
			vehicle: { name: 'Blue van', primaryDriver: { displayName: 'Driver One' } }
		});
		expect(details?.outbound.rides[0].riders.map((rider) => rider.displayName)).toEqual([
			'Member One',
			'Rider Two'
		]);
		expect(details?.currentTransportation.outbound?.tripRideId).toBe('ride-1');
		expect(details?.currentTransportation.return).toBeNull();

		const tripCall = client.calls.find(
			(call) => call.collection === CARPOOL_COLLECTIONS.outboundTrips
		);
		expect(tripCall?.query.filters).toEqual([
			{ field: 'event_id', operator: '_eq', value: 'event-1' },
			{ field: 'status', operator: '_eq', value: 'published' }
		]);
	});

	it('provides all normalized repository boundaries', async () => {
		const client = new FixtureDirectusClient(fixture());
		const repositories = createDirectusRepositories(client);

		expect(await repositories.trips.getById('outbound-1')).toMatchObject({ direction: 'outbound' });
		expect(await repositories.vehicles.listVisible()).toHaveLength(2);
		expect(await repositories.tripRides.getById('ride-1')).toMatchObject({ occupiedSeats: 2 });
		expect(await repositories.transportation.getCurrent('event-1', 'member-1')).toHaveLength(1);
	});
});
