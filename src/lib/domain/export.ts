import type { AdminEventDto, Direction } from './types';

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
