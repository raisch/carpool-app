import { describe, expect, it } from 'vitest';
import { eventRiderCsv, eventRiderExportRows, incompleteRiderIds } from './export';
import type { AdminEventDto } from './types';

const event: AdminEventDto = {
	event: {
		id: '12',
		status: 'published',
		name: 'Boston, "Fall" trip',
		description: null,
		startDate: '2026-12-01',
		endDate: '2026-12-02',
		location: 'Boston'
	},
	trips: [
		{
			id: '21',
			eventId: '12',
			direction: 'return',
			status: 'published',
			destination: 'Waltham',
			departsFrom: 'Boston',
			departsOn: '2026-12-02',
			departsAt: '17:00',
			arrivesAt: null,
			rides: [
				{
					id: '31',
					tripId: '21',
					vehicle: {
						id: '41',
						status: 'published',
						name: 'Van, One',
						vehicleType: 'Van',
						seats: 8,
						primaryDriver: { id: '2', displayName: 'Driver' }
					},
					occupiedSeats: 1,
					remainingSeats: 7,
					riders: [{ id: '3', displayName: 'Rider\nOne' }]
				}
			]
		}
	]
};

describe('event rider export', () => {
	it('flags riders missing a ride or opt-out in either direction', () => {
		const outboundAndReturn = {
			...event,
			trips: [
				{
					...event.trips[0],
					direction: 'outbound' as const,
					id: '20',
					rides: [
						{
							...event.trips[0].rides[0],
							tripId: '20',
							riders: [
								{ id: 'assigned-both', displayName: 'Assigned Both' },
								{ id: 'opted-out', displayName: 'Opted Out' },
								{ id: 'missing-return', displayName: 'Missing Return' }
							]
						}
					]
				},
				{
					...event.trips[0],
					id: '21',
					rides: [
						{
							...event.trips[0].rides[0],
							riders: [
								{ id: 'assigned-both', displayName: 'Assigned Both' },
								{ id: 'missing-outbound', displayName: 'Missing Outbound' }
							]
						}
					]
				}
			],
			transportationDecisions: [
				{
					id: 'decision-1',
					eventId: '12',
					userId: 'opted-out',
					direction: 'return' as const,
					decision: 'opt_out' as const,
					tripRideId: null,
					updatedAt: '2026-11-01T00:00:00Z'
				},
				{
					id: 'decision-2',
					eventId: '12',
					userId: 'missing-outbound',
					direction: 'outbound' as const,
					decision: 'opt_out' as const,
					tripRideId: null,
					updatedAt: '2026-11-01T00:00:00Z'
				}
			]
		};

		expect(incompleteRiderIds(outboundAndReturn)).toEqual(new Set(['missing-return']));
	});

	it('flattens one event deterministically and excludes restricted profile fields', () => {
		const rows = eventRiderExportRows(event);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ eventId: '12', direction: 'return', riderName: 'Rider\nOne' });
		expect(rows[0]).not.toHaveProperty('email');
		expect(rows[0]).not.toHaveProperty('phone');
	});

	it('escapes CSV cells and emits a stable header', () => {
		const csv = eventRiderCsv(event);
		expect(csv.split('\r\n')[0]).toBe(
			'event_id,event_name,event_status,direction,trip_id,departs_on,departs_at,departs_from,destination,vehicle_id,vehicle_name,vehicle_type,primary_driver_id,primary_driver_name,rider_id,rider_name'
		);
		expect(csv).toContain('"Boston, ""Fall"" trip"');
		expect(csv).toContain('"Rider\nOne"');
	});
});
