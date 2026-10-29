import { describe, expect, it } from 'vitest';
import { eventRiderCsv, eventRiderExportRows } from './export';
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
