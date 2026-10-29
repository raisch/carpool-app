export const CARPOOL_COLLECTIONS = {
	events: 'events',
	outboundTrips: 'outbound_trips',
	returnTrips: 'return_trips',
	vehicles: 'vehicles',
	tripRides: 'trip_rides',
	tripRideRiders: 'trip_ride_riders',
	transportationDecisions: 'transportation_decisions',
	users: 'users'
} as const;

export type CarpoolCollection = (typeof CARPOOL_COLLECTIONS)[keyof typeof CARPOOL_COLLECTIONS];

export const CARPOOL_COLLECTION_LIST = Object.values(CARPOOL_COLLECTIONS);

/**
 * Fields the carpool application is allowed to request from Directus.
 *
 * Keep this list deliberately narrower than the Directus schema. In
 * particular, the users collection is a profile reference boundary, not a
 * general-purpose directory API.
 */
export const CARPOOL_FIELD_ALLOWLISTS = {
	events: ['id', 'status', 'name', 'description', 'start_date', 'end_date', 'location'],
	outboundTrips: [
		'id',
		'event_id',
		'status',
		'destination',
		'departs_from',
		'departs_on',
		'departs_at',
		'arrives_at'
	],
	returnTrips: [
		'id',
		'event_id',
		'status',
		'destination',
		'departs_from',
		'departs_on',
		'departs_at',
		'arrives_at'
	],
	vehicles: ['id', 'status', 'name', 'vehicle_type', 'seats', 'primary_driver_id'],
	tripRides: ['id', 'trip_id', 'vehicle_id'],
	tripRideRiders: ['id', 'trip_ride_id', 'user_id'],
	transportationDecisions: [
		'id',
		'event_id',
		'user_id',
		'direction',
		'decision',
		'trip_ride_id',
		'updated_at'
	],
	users: [
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
	]
} as const;

export type CarpoolFieldAllowlist = {
	[K in keyof typeof CARPOOL_FIELD_ALLOWLISTS]: (typeof CARPOOL_FIELD_ALLOWLISTS)[K][number];
};

export const NORMALIZED_COLLECTION_DEFINITIONS = {
	events: {
		collection: CARPOOL_COLLECTIONS.events,
		fields: CARPOOL_FIELD_ALLOWLISTS.events,
		unique: []
	},
	outboundTrips: {
		collection: CARPOOL_COLLECTIONS.outboundTrips,
		fields: CARPOOL_FIELD_ALLOWLISTS.outboundTrips,
		unique: []
	},
	returnTrips: {
		collection: CARPOOL_COLLECTIONS.returnTrips,
		fields: CARPOOL_FIELD_ALLOWLISTS.returnTrips,
		unique: []
	},
	vehicles: {
		collection: CARPOOL_COLLECTIONS.vehicles,
		fields: CARPOOL_FIELD_ALLOWLISTS.vehicles,
		unique: []
	},
	tripRides: {
		collection: CARPOOL_COLLECTIONS.tripRides,
		fields: CARPOOL_FIELD_ALLOWLISTS.tripRides,
		unique: [['trip_id', 'vehicle_id']]
	},
	tripRideRiders: {
		collection: CARPOOL_COLLECTIONS.tripRideRiders,
		fields: CARPOOL_FIELD_ALLOWLISTS.tripRideRiders,
		unique: [['trip_ride_id', 'user_id']]
	},
	transportationDecisions: {
		collection: CARPOOL_COLLECTIONS.transportationDecisions,
		fields: CARPOOL_FIELD_ALLOWLISTS.transportationDecisions,
		unique: [['event_id', 'user_id', 'direction']]
	},
	users: {
		collection: CARPOOL_COLLECTIONS.users,
		fields: CARPOOL_FIELD_ALLOWLISTS.users,
		unique: [['source_system', 'source_uid']]
	}
} as const;
