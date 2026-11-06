import type {
	AdminEventDto,
	Direction,
	TransportationDecisionDto,
	UserReferenceDto
} from './types';

export interface EventRiderExportRow {
	eventId: string;
	eventName: string;
	eventStatus: string;
	direction: Direction;
	tripId: string;
	departsOn: string;
	departsAt: string;
	departsFrom: string;
	destination: string;
	vehicleId: string;
	vehicleName: string;
	vehicleType: string;
	primaryDriverId: string;
	primaryDriverName: string;
	riderId: string;
	riderName: string;
}

const directionOrder: Record<Direction, number> = { outbound: 0, return: 1 };
const directions: Direction[] = ['outbound', 'return'];

export interface CompleteEventRiderStatus {
	riderId: string;
	riderName: string;
	incomplete: boolean;
	outbound: 'assigned' | 'opt_out' | 'incomplete';
	return: 'assigned' | 'opt_out' | 'incomplete';
}

export interface CompleteEventPrintRide {
	direction: Direction;
	tripId: string;
	departsOn: string;
	departsAt: string;
	departsFrom: string;
	destination: string;
	vehicleName: string;
	vehicleType: string;
	driverName: string;
	capacity: number;
	occupiedSeats: number;
	remainingSeats: number;
	riders: UserReferenceDto[];
}

export interface CompleteEventPrintData {
	event: AdminEventDto['event'];
	riders: CompleteEventRiderStatus[];
	rides: CompleteEventPrintRide[];
	incompleteCount: number;
	optOutCount: number;
}

function riderNames(event: AdminEventDto): Map<string, string> {
	const names = new Map<string, string>();
	for (const trip of event.trips) {
		for (const ride of trip.rides) {
			for (const rider of ride.riders) names.set(rider.id, rider.displayName);
		}
	}
	return names;
}

/**
 * Builds the administrator-only operational report from the already-scoped
 * aggregate. It deliberately exposes only names/IDs and fields supported by
 * the aggregate; there is no fabricated notes or management metadata.
 */
export function completeEventPrintData(event: AdminEventDto): CompleteEventPrintData {
	const names = riderNames(event);
	const assigned = new Map<string, Set<Direction>>();
	for (const trip of event.trips) {
		for (const ride of trip.rides) {
			for (const rider of ride.riders) {
				names.set(rider.id, rider.displayName);
				const directionsForRider = assigned.get(rider.id) ?? new Set<Direction>();
				directionsForRider.add(trip.direction);
				assigned.set(rider.id, directionsForRider);
			}
		}
	}

	const decisions = new Map<string, Map<Direction, TransportationDecisionDto['decision']>>();
	for (const decision of event.transportationDecisions ?? []) {
		const riderDecisions = decisions.get(decision.userId) ?? new Map();
		riderDecisions.set(decision.direction, decision.decision);
		decisions.set(decision.userId, riderDecisions);
		if (!names.has(decision.userId)) names.set(decision.userId, decision.userId);
	}

	const riders = [...new Set([...assigned.keys(), ...decisions.keys()])]
		.sort((left, right) => (names.get(left) ?? left).localeCompare(names.get(right) ?? right))
		.map((riderId) => {
			const status = (direction: Direction): CompleteEventRiderStatus[Direction] =>
				assigned.get(riderId)?.has(direction)
					? 'assigned'
					: decisions.get(riderId)?.get(direction) === 'opt_out'
						? 'opt_out'
						: 'incomplete';
			const outbound = status('outbound');
			const returning = status('return');
			return {
				riderId,
				riderName: names.get(riderId) ?? riderId,
				incomplete: outbound === 'incomplete' || returning === 'incomplete',
				outbound,
				return: returning
			};
		});

	const rides = event.trips
		.flatMap((trip) =>
			trip.rides.length > 0
				? trip.rides.map((ride) => ({
						direction: trip.direction,
						tripId: trip.id,
						departsOn: trip.departsOn,
						departsAt: trip.departsAt,
						departsFrom: trip.departsFrom,
						destination: trip.destination,
						vehicleName: ride.vehicle.name,
						vehicleType: ride.vehicle.vehicleType,
						driverName: ride.vehicle.primaryDriver.displayName,
						capacity: ride.vehicle.seats,
						occupiedSeats: ride.occupiedSeats,
						remainingSeats: ride.remainingSeats,
						riders: ride.riders
					}))
				: [
						{
							direction: trip.direction,
							tripId: trip.id,
							departsOn: trip.departsOn,
							departsAt: trip.departsAt,
							departsFrom: trip.departsFrom,
							destination: trip.destination,
							vehicleName: 'No vehicle assigned',
							vehicleType: '—',
							driverName: '—',
							capacity: 0,
							occupiedSeats: 0,
							remainingSeats: 0,
							riders: []
						}
					]
		)
		.sort(
			(left, right) =>
				directionOrder[left.direction] - directionOrder[right.direction] ||
				left.departsOn.localeCompare(right.departsOn) ||
				left.departsAt.localeCompare(right.departsAt) ||
				left.vehicleName.localeCompare(right.vehicleName)
		);

	return {
		event: event.event,
		riders,
		rides,
		incompleteCount: riders.filter((rider) => rider.incomplete).length,
		optOutCount: riders.reduce(
			(count, rider) =>
				count + Number(rider.outbound === 'opt_out') + Number(rider.return === 'opt_out'),
			0
		)
	};
}

/**
 * Returns riders who have no assigned ride and no explicit opt-out in at least
 * one direction. Missing decision data is treated as no decision.
 */
export function incompleteRiderIds(event: AdminEventDto): Set<string> {
	const assignedDirections = new Map<string, Set<Direction>>();
	for (const trip of event.trips) {
		for (const ride of trip.rides) {
			for (const rider of ride.riders) {
				const riderDirections = assignedDirections.get(rider.id) ?? new Set<Direction>();
				riderDirections.add(trip.direction);
				assignedDirections.set(rider.id, riderDirections);
			}
		}
	}

	const optOutDirections = new Map<string, Set<Direction>>();
	for (const decision of event.transportationDecisions ?? []) {
		if (decision.decision !== 'opt_out') continue;
		const riderDirections = optOutDirections.get(decision.userId) ?? new Set<Direction>();
		riderDirections.add(decision.direction);
		optOutDirections.set(decision.userId, riderDirections);
	}

	return new Set(
		[...assignedDirections.keys()].filter((riderId) =>
			directions.some(
				(direction) =>
					!assignedDirections.get(riderId)?.has(direction) &&
					!optOutDirections.get(riderId)?.has(direction)
			)
		)
	);
}

/**
 * Flatten one already-scoped event aggregate into deterministic rider rows.
 * This intentionally contains only the profile fields permitted by the
 * Directus boundary: identifiers and display names, never contact details.
 */
export function eventRiderExportRows(event: AdminEventDto): EventRiderExportRow[] {
	return event.trips
		.flatMap((trip) =>
			trip.rides.flatMap((ride) =>
				ride.riders.map((rider) => ({
					eventId: event.event.id,
					eventName: event.event.name,
					eventStatus: event.event.status,
					direction: trip.direction,
					tripId: trip.id,
					departsOn: trip.departsOn,
					departsAt: trip.departsAt,
					departsFrom: trip.departsFrom,
					destination: trip.destination,
					vehicleId: ride.vehicle.id,
					vehicleName: ride.vehicle.name,
					vehicleType: ride.vehicle.vehicleType,
					primaryDriverId: ride.vehicle.primaryDriver.id,
					primaryDriverName: ride.vehicle.primaryDriver.displayName,
					riderId: rider.id,
					riderName: rider.displayName
				}))
			)
		)
		.sort(
			(left, right) =>
				[
					directionOrder[left.direction] - directionOrder[right.direction],
					left.departsOn.localeCompare(right.departsOn),
					left.departsAt.localeCompare(right.departsAt),
					left.vehicleName.localeCompare(right.vehicleName),
					left.riderName.localeCompare(right.riderName),
					left.riderId.localeCompare(right.riderId)
				].find((value) => value !== 0) ?? 0
		);
}

export const eventRiderCsvHeaders = [
	'event_id',
	'event_name',
	'event_status',
	'direction',
	'trip_id',
	'departs_on',
	'departs_at',
	'departs_from',
	'destination',
	'vehicle_id',
	'vehicle_name',
	'vehicle_type',
	'primary_driver_id',
	'primary_driver_name',
	'rider_id',
	'rider_name'
] as const;

export function csvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function eventRiderCsv(event: AdminEventDto): string {
	const rows = eventRiderExportRows(event);
	const values = rows.map((row) => [
		row.eventId,
		row.eventName,
		row.eventStatus,
		row.direction,
		row.tripId,
		row.departsOn,
		row.departsAt,
		row.departsFrom,
		row.destination,
		row.vehicleId,
		row.vehicleName,
		row.vehicleType,
		row.primaryDriverId,
		row.primaryDriverName,
		row.riderId,
		row.riderName
	]);
	return (
		[eventRiderCsvHeaders, ...values].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
	);
}
