import { describe, expect, it } from 'vitest';
import {
	CARPOOL_COLLECTION_LIST,
	CARPOOL_COLLECTIONS,
	CARPOOL_FIELD_ALLOWLISTS,
	NORMALIZED_COLLECTION_DEFINITIONS
} from './collections';

describe('Directus collection boundary', () => {
	it('contains only normalized carpool collections', () => {
		expect(CARPOOL_COLLECTION_LIST).toEqual([
			'events',
			'outbound_trips',
			'return_trips',
			'vehicles',
			'trip_rides',
			'trip_ride_riders',
			'transportation_decisions',
			'users'
		]);
		expect(CARPOOL_COLLECTIONS).not.toHaveProperty('pages');
		expect(CARPOOL_COLLECTIONS).not.toHaveProperty('posts');
	});

	it('defines the normalized fields and relationship constraints', () => {
		expect(CARPOOL_FIELD_ALLOWLISTS.events).toEqual([
			'id',
			'status',
			'name',
			'description',
			'start_date',
			'end_date',
			'location'
		]);
		expect(CARPOOL_FIELD_ALLOWLISTS.users).toEqual([
			'id',
			'display_name',
			'role',
			'status',
			'source_system',
			'source_uid',
			'first_name',
			'last_name',
			'email',
			'telephone'
		]);
		expect(NORMALIZED_COLLECTION_DEFINITIONS.tripRides.unique).toEqual([['trip_id', 'vehicle_id']]);
		expect(NORMALIZED_COLLECTION_DEFINITIONS.tripRideRiders.unique).toEqual([
			['trip_ride_id', 'user_id']
		]);
		expect(NORMALIZED_COLLECTION_DEFINITIONS.transportationDecisions.unique).toEqual([
			['event_id', 'user_id', 'direction']
		]);
	});
});
