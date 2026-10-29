import type {
	AdminEventDto,
	AdminTripDto,
	AdminTripRideDto,
	AdminVehicleDto,
	AdminUserDto,
	EventDetailsDto,
	EventSummaryDto,
	EventMutationInput,
	TransportationDecisionDto,
	TransportationUpdateInput,
	TripMutationInput,
	TripDto,
	TripRideDto,
	UserAdminMutationInput,
	UserProfileDto,
	UserReferenceDto,
	VehicleMutationInput,
	VehicleDto
} from '#lib/domain/types';
import {
	parseEventSummaryDto,
	parseAdminUserDto,
	parseTransportationDecisionDto,
	parseTripDto,
	parseTripRideDto,
	parseUserProfileDto,
	parseUserReferenceDto,
	parseVehicleDto
} from '#lib/domain/validation';
import { CARPOOL_COLLECTIONS } from '../collections';
import type { CurrentUser } from '../identity';
import type { DirectusClient, DirectusFilter } from '../directus/client';
import type {
	EventRepository,
	AdminRepository,
	TransportationRepository,
	TripRepository,
	TripRideRepository,
	VehicleRepository
} from './contracts';

type RecordValue = Record<string, unknown>;

const userProfileFields = ['id', 'display_name', 'role', 'status'] as const;
const adminUserFields = [
	'id',
	'display_name',
	'role',
	'status',
	'source_system',
	'source_uid'
] as const;

function record(value: unknown, resource: string): RecordValue {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`Directus returned an invalid ${resource} record`);
	}
	return value as RecordValue;
}

function identifier(value: unknown, field: string): string {
	if ((typeof value !== 'string' && typeof value !== 'number') || String(value).length === 0) {
		throw new Error(`Directus ${field} must be a non-empty identifier`);
	}
	return String(value);
}

function nullableIdentifier(value: unknown, field: string): string | null {
	return value === null || value === undefined ? null : identifier(value, field);
}

function toEvent(value: unknown): EventSummaryDto {
	const input = record(value, 'event');
	return parseEventSummaryDto({
		id: identifier(input.id, 'event.id'),
		status: input.status,
		name: input.name,
		description: input.description ?? null,
		startDate: input.start_date,
		endDate: input.end_date,
		location: input.location
	});
}

function toTrip(value: unknown, direction: 'outbound' | 'return'): TripDto {
	const input = record(value, `${direction} trip`);
	return parseTripDto({
		id: identifier(input.id, `${direction} trip.id`),
		eventId: identifier(input.event_id, `${direction} trip.event_id`),
		direction,
		status: input.status,
		destination: input.destination,
		departsFrom: input.departs_from,
		departsOn: input.departs_on,
		departsAt: input.departs_at,
		arrivesAt: input.arrives_at ?? null
	});
}

function toUserReference(value: unknown): UserReferenceDto {
	const input = record(value, 'user');
	return parseUserReferenceDto({
		id: identifier(input.id, 'user.id'),
		displayName: input.display_name
	});
}

function toUserProfile(value: unknown): UserProfileDto {
	const input = record(value, 'user');
	return parseUserProfileDto({
		id: identifier(input.id, 'user.id'),
		displayName: input.display_name,
		role: input.role,
		status: input.status
	});
}

function toVehicle(value: unknown, primaryDriver: UserReferenceDto): VehicleDto {
	const input = record(value, 'vehicle');
	return parseVehicleDto({
		id: identifier(input.id, 'vehicle.id'),
		status: input.status,
		name: input.name,
		vehicleType: input.vehicle_type,
		seats: input.seats,
		primaryDriver
	});
}

function toDecision(value: unknown): TransportationDecisionDto {
	const input = record(value, 'transportation decision');
	return parseTransportationDecisionDto({
		id: identifier(input.id, 'transportation_decision.id'),
		eventId: identifier(input.event_id, 'transportation_decision.event_id'),
		userId: identifier(input.user_id, 'transportation_decision.user_id'),
		direction: input.direction,
		decision: input.decision,
		tripRideId: nullableIdentifier(input.trip_ride_id, 'transportation_decision.trip_ride_id'),
		updatedAt: input.updated_at
	});
}

function equal(field: string, value: string): DirectusFilter {
	return { field, operator: '_eq', value };
}

function inList(field: string, values: readonly string[]): DirectusFilter {
	return { field, operator: '_in', value: values };
}

async function loadUsers(
	client: DirectusClient,
	ids: readonly string[]
): Promise<Map<string, UserReferenceDto>> {
	if (ids.length === 0) return new Map();
	const records = await client.readItems(CARPOOL_COLLECTIONS.users, {
		fields: ['id', 'display_name'],
		filters: [inList('id', ids)]
	});
	return new Map(
		records.map((value) => {
			const user = toUserReference(value);
			return [user.id, user] as const;
		})
	);
}

interface RawTripRide {
	record: RecordValue;
	vehicle: VehicleDto;
	riders: UserReferenceDto[];
}

async function loadTripRides(
	client: DirectusClient,
	tripId: string,
	visibleOnly = true
): Promise<RawTripRide[]> {
	const tripRideRecords = await client.readItems(CARPOOL_COLLECTIONS.tripRides, {
		filters: [equal('trip_id', tripId)]
	});
	if (tripRideRecords.length === 0) return [];

	const tripRideIds = tripRideRecords.map((value) =>
		identifier(record(value, 'trip ride').id, 'trip ride.id')
	);
	const riderRecords = await client.readItems(CARPOOL_COLLECTIONS.tripRideRiders, {
		filters: [inList('trip_ride_id', tripRideIds)]
	});
	const vehicleIds = tripRideRecords.map((value) =>
		identifier(record(value, 'trip ride').vehicle_id, 'trip ride.vehicle_id')
	);
	const vehicleFilters: DirectusFilter[] = [inList('id', vehicleIds)];
	if (visibleOnly) vehicleFilters.push(equal('status', 'published'));
	const vehicleRecords = await client.readItems(CARPOOL_COLLECTIONS.vehicles, {
		filters: vehicleFilters
	});
	const vehicleById = new Map(
		vehicleRecords.map((value) => {
			const input = record(value, 'vehicle');
			return [identifier(input.id, 'vehicle.id'), input] as const;
		})
	);
	const driverIds = vehicleRecords.map((value) =>
		identifier(record(value, 'vehicle').primary_driver_id, 'vehicle.primary_driver_id')
	);
	const riderIds = riderRecords.map((value) =>
		identifier(record(value, 'trip ride rider').user_id, 'rider.user_id')
	);
	const users = await loadUsers(client, [...new Set([...driverIds, ...riderIds])]);
	const ridersByTripRide = new Map<string, UserReferenceDto[]>();
	for (const value of riderRecords) {
		const input = record(value, 'trip ride rider');
		const tripRideId = identifier(input.trip_ride_id, 'rider.trip_ride_id');
		const user = users.get(identifier(input.user_id, 'rider.user_id'));
		if (!user) throw new Error(`Rider user ${input.user_id} was not returned by Directus`);
		ridersByTripRide.set(tripRideId, [...(ridersByTripRide.get(tripRideId) ?? []), user]);
	}

	const result: RawTripRide[] = [];
	for (const value of tripRideRecords) {
		const input = record(value, 'trip ride');
		const id = identifier(input.id, 'trip ride.id');
		const vehicle = vehicleById.get(identifier(input.vehicle_id, 'trip ride.vehicle_id'));
		if (!vehicle) {
			if (visibleOnly) continue;
			throw new Error(`Vehicle ${input.vehicle_id} was not returned by Directus`);
		}
		const primaryDriver = users.get(
			identifier(vehicle.primary_driver_id, 'vehicle.primary_driver_id')
		);
		if (!primaryDriver)
			throw new Error(`Vehicle driver ${vehicle.primary_driver_id} was not returned by Directus`);
		const riders = ridersByTripRide.get(id) ?? [];
		result.push({ record: input, vehicle: toVehicle(vehicle, primaryDriver), riders });
	}
	return result;
}

function toTripRide(value: RawTripRide): TripRideDto {
	const id = identifier(value.record.id, 'trip ride.id');
	const riders = value.riders;
	return parseTripRideDto({
		id,
		tripId: identifier(value.record.trip_id, 'trip ride.trip_id'),
		vehicle: value.vehicle,
		occupiedSeats: riders.length,
		remainingSeats: Math.max(0, value.vehicle.seats - riders.length),
		riders
	});
}

async function loadPublishedTrip(
	client: DirectusClient,
	collection: typeof CARPOOL_COLLECTIONS.outboundTrips | typeof CARPOOL_COLLECTIONS.returnTrips,
	direction: 'outbound' | 'return',
	eventId: string
): Promise<TripDto | null> {
	const records = await client.readItems(collection, {
		filters: [equal('event_id', eventId), equal('status', 'published')],
		sort: ['departs_on', 'departs_at'],
		limit: 1
	});
	return records[0] ? toTrip(records[0], direction) : null;
}

async function loadAnyTrip(
	client: DirectusClient,
	collection: typeof CARPOOL_COLLECTIONS.outboundTrips | typeof CARPOOL_COLLECTIONS.returnTrips,
	direction: 'outbound' | 'return',
	tripId: string
): Promise<TripDto | null> {
	const records = await client.readItems(collection, {
		filters: [equal('id', tripId)],
		limit: 1
	});
	return records[0] ? toTrip(records[0], direction) : null;
}

async function loadAdminTrip(client: DirectusClient, trip: TripDto): Promise<AdminTripDto> {
	const rides = await loadTripRides(client, trip.id, false);
	return { ...trip, rides: rides.map(toTripRide) };
}

export class DirectusEventRepository implements EventRepository {
	constructor(private readonly client: DirectusClient) {}

	async listPublished(): Promise<EventSummaryDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.events, {
			filters: [equal('status', 'published')],
			sort: ['start_date', 'name']
		});
		return records.map(toEvent);
	}

	async getPublishedDetails(
		eventId: string,
		currentUser: CurrentUser | null
	): Promise<EventDetailsDto | null> {
		const eventRecords = await this.client.readItems(CARPOOL_COLLECTIONS.events, {
			filters: [equal('id', eventId), equal('status', 'published')],
			limit: 1
		});
		if (!eventRecords[0]) return null;

		const event = toEvent(eventRecords[0]);
		const [outboundTrip, returnTrip] = await Promise.all([
			loadPublishedTrip(this.client, CARPOOL_COLLECTIONS.outboundTrips, 'outbound', event.id),
			loadPublishedTrip(this.client, CARPOOL_COLLECTIONS.returnTrips, 'return', event.id)
		]);
		const [outboundRides, returnRides] = await Promise.all([
			outboundTrip ? loadTripRides(this.client, outboundTrip.id) : Promise.resolve([]),
			returnTrip ? loadTripRides(this.client, returnTrip.id) : Promise.resolve([])
		]);
		const decisions = currentUser
			? await this.client.readItems(CARPOOL_COLLECTIONS.transportationDecisions, {
					filters: [equal('event_id', event.id), equal('user_id', currentUser.id)]
				})
			: [];
		const parsedDecisions = decisions.map(toDecision);

		return {
			event,
			outbound: {
				trip: outboundTrip,
				rides: outboundRides.map(toTripRide)
			},
			return: {
				trip: returnTrip,
				rides: returnRides.map(toTripRide)
			},
			currentTransportation: {
				outbound: parsedDecisions.find((decision) => decision.direction === 'outbound') ?? null,
				return: parsedDecisions.find((decision) => decision.direction === 'return') ?? null
			}
		};
	}
}

export class DirectusTripRepository implements TripRepository {
	constructor(private readonly client: DirectusClient) {}

	async getById(tripId: string): Promise<TripDto | null> {
		const [outbound, returning] = await Promise.all([
			this.client.readItems(CARPOOL_COLLECTIONS.outboundTrips, {
				filters: [equal('id', tripId)],
				limit: 1
			}),
			this.client.readItems(CARPOOL_COLLECTIONS.returnTrips, {
				filters: [equal('id', tripId)],
				limit: 1
			})
		]);
		return outbound[0]
			? toTrip(outbound[0], 'outbound')
			: returning[0]
				? toTrip(returning[0], 'return')
				: null;
	}
}

export class DirectusVehicleRepository implements VehicleRepository {
	constructor(private readonly client: DirectusClient) {}

	async listVisible(): Promise<VehicleDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.vehicles, {
			filters: [equal('status', 'published')],
			sort: ['name']
		});
		const driverIds = records.map((value) =>
			identifier(record(value, 'vehicle').primary_driver_id, 'vehicle.primary_driver_id')
		);
		const users = await loadUsers(this.client, [...new Set(driverIds)]);
		return records.map((value) => {
			const input = record(value, 'vehicle');
			const driverId = identifier(input.primary_driver_id, 'vehicle.primary_driver_id');
			const driver = users.get(driverId);
			if (!driver) throw new Error(`Vehicle driver ${driverId} was not returned by Directus`);
			return toVehicle(input, driver);
		});
	}
}

export class DirectusTripRideRepository implements TripRideRepository {
	constructor(private readonly client: DirectusClient) {}

	async getById(tripRideId: string): Promise<TripRideDto | null> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.tripRides, {
			filters: [equal('id', tripRideId)],
			limit: 1
		});
		if (!records[0]) return null;
		const tripId = identifier(record(records[0], 'trip ride').trip_id, 'trip ride.trip_id');
		const rides = await loadTripRides(this.client, tripId, false);
		const ride = rides.find((value) => identifier(value.record.id, 'trip ride.id') === tripRideId);
		return ride ? toTripRide(ride) : null;
	}
}

export class DirectusTransportationRepository implements TransportationRepository {
	constructor(private readonly client: DirectusClient) {}

	async getCurrent(eventId: string, userId: string): Promise<TransportationDecisionDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.transportationDecisions, {
			filters: [equal('event_id', eventId), equal('user_id', userId)]
		});
		return records.map(toDecision);
	}

	replaceCurrent(eventId: string, userId: string, input: TransportationUpdateInput): Promise<void> {
		return this.client.replaceTransportation(eventId, userId, input);
	}
}

export class DirectusAdminRepository implements AdminRepository {
	constructor(private readonly client: DirectusClient) {}

	async listEvents(): Promise<EventSummaryDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.events, {
			sort: ['start_date', 'name']
		});
		return records.map(toEvent);
	}

	async getEvent(eventId: string): Promise<AdminEventDto | null> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.events, {
			filters: [equal('id', eventId)],
			limit: 1
		});
		if (!records[0]) return null;
		const event = toEvent(records[0]);
		const trips = (
			await Promise.all(
				[
					['outbound', CARPOOL_COLLECTIONS.outboundTrips] as const,
					['return', CARPOOL_COLLECTIONS.returnTrips] as const
				].map(async ([direction, collection]) => {
					const tripRecords = await this.client.readItems(collection, {
						filters: [equal('event_id', eventId)],
						sort: ['departs_on', 'departs_at']
					});
					return Promise.all(
						tripRecords.map((value) => loadAdminTrip(this.client, toTrip(value, direction)))
					);
				})
			)
		).flat();
		return { event, trips };
	}

	async createEvent(input: EventMutationInput): Promise<EventSummaryDto> {
		return toEvent(
			await this.client.createItem(CARPOOL_COLLECTIONS.events, {
				status: input.status,
				name: input.name,
				description: input.description,
				start_date: input.startDate,
				end_date: input.endDate,
				location: input.location
			})
		);
	}

	async updateEvent(eventId: string, input: EventMutationInput): Promise<EventSummaryDto | null> {
		const current = await this.client.readItems(CARPOOL_COLLECTIONS.events, {
			filters: [equal('id', eventId)],
			limit: 1
		});
		if (!current[0]) return null;
		return toEvent(
			await this.client.updateItem(CARPOOL_COLLECTIONS.events, eventId, {
				status: input.status,
				name: input.name,
				description: input.description,
				start_date: input.startDate,
				end_date: input.endDate,
				location: input.location
			})
		);
	}

	deleteEvent(eventId: string): Promise<void> {
		return this.client.deleteItem(CARPOOL_COLLECTIONS.events, eventId);
	}

	async getTrip(tripId: string): Promise<AdminTripDto | null> {
		const [outbound, returning] = await Promise.all([
			loadAnyTrip(this.client, CARPOOL_COLLECTIONS.outboundTrips, 'outbound', tripId),
			loadAnyTrip(this.client, CARPOOL_COLLECTIONS.returnTrips, 'return', tripId)
		]);
		const trip = outbound ?? returning;
		return trip ? loadAdminTrip(this.client, trip) : null;
	}

	async createTrip(input: TripMutationInput): Promise<TripDto> {
		const collection =
			input.direction === 'outbound'
				? CARPOOL_COLLECTIONS.outboundTrips
				: CARPOOL_COLLECTIONS.returnTrips;
		return toTrip(
			await this.client.createItem(collection, {
				event_id: input.eventId,
				status: input.status,
				destination: input.destination,
				departs_from: input.departsFrom,
				departs_on: input.departsOn,
				departs_at: input.departsAt,
				arrives_at: input.arrivesAt
			}),
			input.direction
		);
	}

	async updateTrip(tripId: string, input: TripMutationInput): Promise<TripDto | null> {
		const current = await this.getTrip(tripId);
		if (!current) return null;
		const collection =
			current.direction === 'outbound'
				? CARPOOL_COLLECTIONS.outboundTrips
				: CARPOOL_COLLECTIONS.returnTrips;
		return toTrip(
			await this.client.updateItem(collection, tripId, {
				event_id: input.eventId,
				status: input.status,
				destination: input.destination,
				departs_from: input.departsFrom,
				departs_on: input.departsOn,
				departs_at: input.departsAt,
				arrives_at: input.arrivesAt
			}),
			current.direction
		);
	}

	async deleteTrip(tripId: string): Promise<void> {
		const current = await this.getTrip(tripId);
		if (!current) return;
		const collection =
			current.direction === 'outbound'
				? CARPOOL_COLLECTIONS.outboundTrips
				: CARPOOL_COLLECTIONS.returnTrips;
		await this.client.deleteItem(collection, tripId);
	}

	private async vehicleDetails(value: unknown): Promise<AdminVehicleDto> {
		const input = record(value, 'vehicle');
		const vehicleId = identifier(input.id, 'vehicle.id');
		const driverId = identifier(input.primary_driver_id, 'vehicle.primary_driver_id');
		const users = await loadUsers(this.client, [driverId]);
		const driver = users.get(driverId);
		if (!driver) throw new Error(`Vehicle driver ${driverId} was not returned by Directus`);
		const vehicle = toVehicle(input, driver);
		const rideRecords = await this.client.readItems(CARPOOL_COLLECTIONS.tripRides, {
			filters: [equal('vehicle_id', vehicleId)]
		});
		const assignments = await Promise.all(
			rideRecords.map(async (rideRecord) => {
				const rideId = identifier(record(rideRecord, 'trip ride').id, 'trip ride.id');
				const tripId = identifier(record(rideRecord, 'trip ride').trip_id, 'trip ride.trip_id');
				const trip = await this.getTrip(tripId);
				if (!trip) throw new Error(`Trip ${tripId} was not returned by Directus`);
				const ride = trip.rides.find((candidate) => candidate.id === rideId);
				if (!ride) throw new Error(`Trip ride ${rideId} was not returned by Directus`);
				return { tripRideId: ride.id, trip, riders: ride.riders };
			})
		);
		return { vehicle, assignments };
	}

	async listVehicles(): Promise<AdminVehicleDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.vehicles, {
			sort: ['name']
		});
		return Promise.all(records.map((value) => this.vehicleDetails(value)));
	}

	async getVehicle(vehicleId: string): Promise<AdminVehicleDto | null> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.vehicles, {
			filters: [equal('id', vehicleId)],
			limit: 1
		});
		return records[0] ? this.vehicleDetails(records[0]) : null;
	}

	async createVehicle(input: VehicleMutationInput): Promise<VehicleDto> {
		const record = await this.client.createItem(CARPOOL_COLLECTIONS.vehicles, {
			status: input.status,
			name: input.name,
			vehicle_type: input.vehicleType,
			seats: input.seats,
			primary_driver_id: input.primaryDriverId
		});
		const value = await this.getVehicle(
			identifier(recordValue(record, 'vehicle').id, 'vehicle.id')
		);
		if (!value) throw new Error('Created vehicle was not returned by Directus');
		return value.vehicle;
	}

	async updateVehicle(vehicleId: string, input: VehicleMutationInput): Promise<VehicleDto | null> {
		if (!(await this.getVehicle(vehicleId))) return null;
		const record = await this.client.updateItem(CARPOOL_COLLECTIONS.vehicles, vehicleId, {
			status: input.status,
			name: input.name,
			vehicle_type: input.vehicleType,
			seats: input.seats,
			primary_driver_id: input.primaryDriverId
		});
		return toVehicle(
			record,
			(await this.getUser(input.primaryDriverId)) ??
				(() => {
					throw new Error('Vehicle driver was not returned by Directus');
				})()
		);
	}

	deleteVehicle(vehicleId: string): Promise<void> {
		return this.client.deleteItem(CARPOOL_COLLECTIONS.vehicles, vehicleId);
	}

	async getTripRide(tripRideId: string): Promise<AdminTripRideDto | null> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.tripRides, {
			filters: [equal('id', tripRideId)],
			limit: 1
		});
		if (!records[0]) return null;
		const tripId = identifier(record(records[0], 'trip ride').trip_id, 'trip ride.trip_id');
		const trip = await this.getTrip(tripId);
		if (!trip) return null;
		const ride = trip.rides.find((candidate) => candidate.id === tripRideId);
		return ride ? { tripRide: ride, trip } : null;
	}

	async createTripRide(tripId: string, vehicleId: string): Promise<TripRideDto> {
		const record = await this.client.createItem(CARPOOL_COLLECTIONS.tripRides, {
			trip_id: tripId,
			vehicle_id: vehicleId
		});
		const ride = await this.getTripRide(
			identifier(recordValue(record, 'trip ride').id, 'trip ride.id')
		);
		if (!ride) throw new Error('Created trip ride was not returned by Directus');
		return ride.tripRide;
	}

	deleteTripRide(tripRideId: string): Promise<void> {
		return this.client.deleteItem(CARPOOL_COLLECTIONS.tripRides, tripRideId);
	}

	async addRider(tripRideId: string, userId: string): Promise<void> {
		await this.client.createItem(CARPOOL_COLLECTIONS.tripRideRiders, {
			trip_ride_id: tripRideId,
			user_id: userId
		});
	}

	async removeRider(tripRideId: string, userId: string): Promise<void> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.tripRideRiders, {
			filters: [equal('trip_ride_id', tripRideId), equal('user_id', userId)],
			limit: 1
		});
		if (records[0]) {
			await this.client.deleteItem(
				CARPOOL_COLLECTIONS.tripRideRiders,
				identifier(record(records[0], 'rider').id, 'rider.id')
			);
		}
	}

	async moveRider(
		sourceTripRideId: string,
		destinationTripRideId: string,
		userId: string
	): Promise<void> {
		await this.removeRider(sourceTripRideId, userId);
		await this.addRider(destinationTripRideId, userId);
	}

	async getUser(userId: string): Promise<UserProfileDto | null> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.users, {
			fields: userProfileFields,
			filters: [equal('id', userId)],
			limit: 1
		});
		return records[0] ? toUserProfile(records[0]) : null;
	}

	async listUsers(): Promise<AdminUserDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.users, {
			fields: adminUserFields,
			sort: ['display_name']
		});
		return records.map((value) => {
			const input = record(value, 'user');
			return parseAdminUserDto({
				...toUserProfile(value),
				sourceSystem: input.source_system,
				sourceUid: input.source_uid
			});
		});
	}

	async updateUser(userId: string, input: UserAdminMutationInput): Promise<UserProfileDto | null> {
		const value = await this.client.updateCarpoolUser(userId, input);
		return value ? toUserProfile(value) : null;
	}

	async listDrivers(): Promise<UserProfileDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.users, {
			fields: userProfileFields,
			filters: [equal('role', 'driver'), equal('status', 'active')],
			sort: ['display_name']
		});
		return records.map(toUserProfile);
	}

	async listRiders(): Promise<UserProfileDto[]> {
		const records = await this.client.readItems(CARPOOL_COLLECTIONS.users, {
			fields: userProfileFields,
			filters: [equal('role', 'rider'), equal('status', 'active')],
			sort: ['display_name']
		});
		return records.map(toUserProfile);
	}
}

function recordValue(value: unknown, resource: string): RecordValue {
	return record(value, resource);
}

export function createDirectusRepositories(client: DirectusClient) {
	return {
		admin: new DirectusAdminRepository(client),
		events: new DirectusEventRepository(client),
		trips: new DirectusTripRepository(client),
		vehicles: new DirectusVehicleRepository(client),
		tripRides: new DirectusTripRideRepository(client),
		transportation: new DirectusTransportationRepository(client)
	};
}
