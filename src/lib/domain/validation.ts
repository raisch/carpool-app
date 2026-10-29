import type {
	Direction,
	EventMutationInput,
	EventDetailsDto,
	EventSummaryDto,
	LifecycleStatus,
	AdminUserDto,
	TransportationDecision,
	TransportationDecisionDto,
	TransportationDecisionInput,
	TransportationUpdateInput,
	TripMutationInput,
	TripDto,
	TripRideDto,
	RiderMutationInput,
	UserAdminMutationInput,
	UserProfileDto,
	UserReferenceDto,
	VehicleMutationInput,
	VehicleDto
} from './types';

export class DtoValidationError extends Error {
	readonly code = 'invalid_dto';
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'DtoValidationError';
	}
}

const lifecycleStatuses = ['draft', 'published', 'archived'] as const;
const directions = ['outbound', 'return'] as const;
const decisions = ['ride', 'opt_out'] as const;

function record(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new DtoValidationError('Expected an object');
	}

	return value as Record<string, unknown>;
}

function stringField(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new DtoValidationError(`${field} must be a non-empty string`);
	}

	return value;
}

function identifierField(value: unknown, field: string): string {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
	return stringField(value, field);
}

function nullableStringField(value: unknown, field: string): string | null {
	if (value === null) return null;
	return stringField(value, field);
}

function enumField<T extends string>(value: unknown, field: string, values: readonly T[]): T {
	if (typeof value !== 'string' || !values.includes(value as T)) {
		throw new DtoValidationError(`${field} is invalid`);
	}

	return value as T;
}

function dateField(value: unknown, field: string): string {
	const result = stringField(value, field);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
		throw new DtoValidationError(`${field} must be an ISO date`);
	}
	return result;
}

function timeField(value: unknown, field: string, nullable = false): string | null {
	if ((value === null || value === undefined) && nullable) return null;
	const result = stringField(value, field);
	if (!/^\d{2}:\d{2}(:\d{2})?$/.test(result)) {
		throw new DtoValidationError(`${field} must be an ISO time`);
	}
	const [hours, minutes] = result.split(':').map(Number);
	if (hours > 23 || minutes > 59) throw new DtoValidationError(`${field} is invalid`);
	return result;
}

export function parseUserReferenceDto(value: unknown): UserReferenceDto {
	const input = record(value);
	return {
		id: stringField(input.id, 'id'),
		displayName: stringField(input.displayName, 'displayName')
	};
}

export function parseUserProfileDto(value: unknown): UserProfileDto {
	const input = record(value);
	return {
		...parseUserReferenceDto(input),
		role: enumField(input.role, 'role', ['rider', 'driver', 'admin'] as const),
		status: enumField(input.status, 'status', ['active', 'inactive'] as const)
	};
}

export function parseAdminUserDto(value: unknown): AdminUserDto {
	const input = record(value);
	return {
		...parseUserProfileDto(input),
		sourceSystem: stringField(input.sourceSystem, 'sourceSystem'),
		sourceUid: stringField(input.sourceUid, 'sourceUid')
	};
}

export function parseUserAdminMutationInput(value: unknown): UserAdminMutationInput {
	const input = record(value);
	hasOnlyKeys(input, ['role', 'status']);
	return {
		role: enumField(input.role, 'role', ['rider', 'driver', 'admin'] as const),
		status: enumField(input.status, 'status', ['active', 'inactive'] as const)
	};
}

export function parseEventSummaryDto(value: unknown): EventSummaryDto {
	const input = record(value);
	return {
		id: stringField(input.id, 'id'),
		status: enumField(input.status, 'status', lifecycleStatuses),
		name: stringField(input.name, 'name'),
		description: nullableStringField(input.description, 'description'),
		startDate: stringField(input.startDate, 'startDate'),
		endDate: stringField(input.endDate, 'endDate'),
		location: stringField(input.location, 'location')
	};
}

export function parseEventMutationInput(value: unknown): EventMutationInput {
	const input = record(value);
	hasOnlyKeys(input, ['status', 'name', 'description', 'startDate', 'endDate', 'location']);
	const startDate = dateField(input.startDate, 'startDate');
	const endDate = dateField(input.endDate, 'endDate');
	if (startDate > endDate) throw new DtoValidationError('startDate cannot be after endDate');
	return {
		status: enumField(input.status, 'status', lifecycleStatuses),
		name: stringField(input.name, 'name'),
		description: nullableStringField(input.description, 'description'),
		startDate,
		endDate,
		location: stringField(input.location, 'location')
	};
}

export function parseTripDto(value: unknown): TripDto {
	const input = record(value);
	return {
		id: stringField(input.id, 'id'),
		eventId: identifierField(input.eventId, 'eventId'),
		direction: enumField(input.direction, 'direction', directions),
		status: enumField(input.status, 'status', lifecycleStatuses),
		destination: stringField(input.destination, 'destination'),
		departsFrom: stringField(input.departsFrom, 'departsFrom'),
		departsOn: stringField(input.departsOn, 'departsOn'),
		departsAt: stringField(input.departsAt, 'departsAt'),
		arrivesAt: nullableStringField(input.arrivesAt, 'arrivesAt')
	};
}

export function parseTripMutationInput(value: unknown): TripMutationInput {
	const input = record(value);
	hasOnlyKeys(input, [
		'eventId',
		'direction',
		'status',
		'destination',
		'departsFrom',
		'departsOn',
		'departsAt',
		'arrivesAt'
	]);
	const departsOn = dateField(input.departsOn, 'departsOn');
	const departsAt = timeField(input.departsAt, 'departsAt');
	const arrivesAt = timeField(input.arrivesAt, 'arrivesAt', true);
	if (!departsAt) throw new DtoValidationError('departsAt is required');
	return {
		eventId: identifierField(input.eventId, 'eventId'),
		direction: enumField(input.direction, 'direction', directions),
		status: enumField(input.status, 'status', lifecycleStatuses),
		destination: stringField(input.destination, 'destination'),
		departsFrom: stringField(input.departsFrom, 'departsFrom'),
		departsOn,
		departsAt,
		arrivesAt
	};
}

export function parseVehicleDto(value: unknown): VehicleDto {
	const input = record(value);
	if (typeof input.seats !== 'number' || !Number.isInteger(input.seats) || input.seats < 1) {
		throw new DtoValidationError('seats must be a positive integer');
	}

	return {
		id: stringField(input.id, 'id'),
		status: enumField(input.status, 'status', lifecycleStatuses),
		name: stringField(input.name, 'name'),
		vehicleType: stringField(input.vehicleType, 'vehicleType'),
		seats: input.seats,
		primaryDriver: parseUserReferenceDto(input.primaryDriver)
	};
}

export function parseVehicleMutationInput(value: unknown): VehicleMutationInput {
	const input = record(value);
	hasOnlyKeys(input, ['status', 'name', 'vehicleType', 'seats', 'primaryDriverId']);
	if (typeof input.seats !== 'number' || !Number.isInteger(input.seats) || input.seats < 1) {
		throw new DtoValidationError('seats must be a positive integer');
	}
	return {
		status: enumField(input.status, 'status', lifecycleStatuses),
		name: stringField(input.name, 'name'),
		vehicleType: stringField(input.vehicleType, 'vehicleType'),
		seats: input.seats,
		primaryDriverId: identifierField(input.primaryDriverId, 'primaryDriverId')
	};
}

export function parseTripRideDto(value: unknown): TripRideDto {
	const input = record(value);
	if (!Array.isArray(input.riders)) {
		throw new DtoValidationError('riders must be an array');
	}
	if (
		typeof input.occupiedSeats !== 'number' ||
		!Number.isInteger(input.occupiedSeats) ||
		input.occupiedSeats < 0
	) {
		throw new DtoValidationError('occupiedSeats must be a non-negative integer');
	}
	if (
		typeof input.remainingSeats !== 'number' ||
		!Number.isInteger(input.remainingSeats) ||
		input.remainingSeats < 0
	) {
		throw new DtoValidationError('remainingSeats must be a non-negative integer');
	}

	return {
		id: stringField(input.id, 'id'),
		tripId: stringField(input.tripId, 'tripId'),
		vehicle: parseVehicleDto(input.vehicle),
		occupiedSeats: input.occupiedSeats,
		remainingSeats: input.remainingSeats,
		riders: input.riders.map(parseUserReferenceDto)
	};
}

export function parseTransportationDecisionDto(value: unknown): TransportationDecisionDto {
	const input = record(value);
	return {
		id: stringField(input.id, 'id'),
		eventId: stringField(input.eventId, 'eventId'),
		userId: identifierField(input.userId, 'userId'),
		direction: enumField(input.direction, 'direction', directions),
		decision: enumField(input.decision, 'decision', decisions),
		tripRideId: nullableStringField(input.tripRideId, 'tripRideId'),
		updatedAt: stringField(input.updatedAt, 'updatedAt')
	};
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
	const allowedKeys = new Set(allowed);
	for (const key of Object.keys(input)) {
		if (!allowedKeys.has(key)) throw new DtoValidationError(`${key} is not allowed`);
	}
}

export function parseTransportationDecisionInput(value: unknown): TransportationDecisionInput {
	const input = record(value);
	hasOnlyKeys(input, ['decision', 'tripRideId']);
	const decision = enumField(input.decision, 'decision', decisions);
	const tripRideId =
		input.tripRideId === undefined ? null : nullableStringField(input.tripRideId, 'tripRideId');

	if (decision === 'ride' && tripRideId === null) {
		throw new DtoValidationError('tripRideId is required when decision is ride');
	}
	if (decision === 'opt_out' && tripRideId !== null) {
		throw new DtoValidationError('tripRideId must be null when decision is opt_out');
	}

	return { decision, tripRideId };
}

export function parseTransportationUpdateInput(value: unknown): TransportationUpdateInput {
	const input = record(value);
	hasOnlyKeys(input, ['outbound', 'return', 'expectedUpdatedAt']);
	if (!Object.hasOwn(input, 'outbound') || !Object.hasOwn(input, 'return')) {
		throw new DtoValidationError('outbound and return decisions are required');
	}
	const expectedUpdatedAt =
		input.expectedUpdatedAt === undefined
			? undefined
			: nullableStringField(input.expectedUpdatedAt, 'expectedUpdatedAt');

	return {
		outbound: parseTransportationDecisionInput(input.outbound),
		return: parseTransportationDecisionInput(input.return),
		expectedUpdatedAt
	};
}

export function parseRiderMutationInput(value: unknown): RiderMutationInput {
	const input = record(value);
	hasOnlyKeys(input, ['userId', 'destinationTripRideId']);
	return {
		userId: identifierField(input.userId, 'userId'),
		destinationTripRideId:
			input.destinationTripRideId === undefined
				? undefined
				: stringField(input.destinationTripRideId, 'destinationTripRideId')
	};
}

export function parseEventDetailsDto(value: unknown): EventDetailsDto {
	const input = record(value);
	const outbound = record(input.outbound);
	const returning = record(input.return);
	const currentTransportation = record(input.currentTransportation);
	if (!Array.isArray(outbound.rides) || !Array.isArray(returning.rides)) {
		throw new DtoValidationError('direction rides must be arrays');
	}

	return {
		event: parseEventSummaryDto(input.event),
		outbound: {
			trip: outbound.trip === null ? null : parseTripDto(outbound.trip),
			rides: outbound.rides.map(parseTripRideDto)
		},
		return: {
			trip: returning.trip === null ? null : parseTripDto(returning.trip),
			rides: returning.rides.map(parseTripRideDto)
		},
		currentTransportation: {
			outbound:
				currentTransportation.outbound === null
					? null
					: parseTransportationDecisionDto(currentTransportation.outbound),
			return:
				currentTransportation.return === null
					? null
					: parseTransportationDecisionDto(currentTransportation.return)
		}
	};
}

export function isLifecycleStatus(value: unknown): value is LifecycleStatus {
	return typeof value === 'string' && lifecycleStatuses.includes(value as LifecycleStatus);
}

export function isDirection(value: unknown): value is Direction {
	return typeof value === 'string' && directions.includes(value as Direction);
}

export function isTransportationDecision(value: unknown): value is TransportationDecision {
	return typeof value === 'string' && decisions.includes(value as TransportationDecision);
}
