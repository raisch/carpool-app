import { describe, expect, it } from 'vitest';
import { DtoValidationError, parseEventSummaryDto, parseVehicleDto } from './validation';

describe('DTO validation', () => {
	it('accepts only the documented event summary fields', () => {
		const result = parseEventSummaryDto({
			id: 'event-1',
			status: 'published',
			name: 'Regional competition',
			description: null,
			startDate: '2026-11-01',
			endDate: '2026-11-02',
			location: 'Boston'
		});

		expect(result).toEqual({
			id: 'event-1',
			status: 'published',
			name: 'Regional competition',
			description: null,
			startDate: '2026-11-01',
			endDate: '2026-11-02',
			location: 'Boston'
		});
		expect('password' in result).toBe(false);
	});

	it('rejects invalid lifecycle values and vehicle capacities', () => {
		expect(() =>
			parseEventSummaryDto({
				id: 'event-1',
				status: 'deleted',
				name: 'Event',
				description: null,
				startDate: '2026-11-01',
				endDate: '2026-11-02',
				location: 'Boston'
			})
		).toThrow(DtoValidationError);

		expect(() =>
			parseVehicleDto({
				id: 'vehicle-1',
				status: 'published',
				name: 'Team van',
				vehicleType: 'Van',
				seats: 0,
				primaryDriver: { id: 'user-1', displayName: 'Driver' }
			})
		).toThrow('seats must be a positive integer');
	});
});
