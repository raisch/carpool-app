import { describe, expect, it } from 'vitest';
import type {
	EventDetailsDto,
	TransportationDecisionDto,
	TransportationUpdateInput,
	TripRideDto
} from '#lib/domain/types';
import { DtoValidationError } from '#lib/domain/validation';
import { TransportationConflictError } from '../errors';
import type { EventRepository, TransportationRepository } from '../repositories/contracts';
import type { CurrentUser } from '../identity';
import { TransportationService } from './transportation-service';

const currentUser: CurrentUser = { id: 'member-1', displayName: 'Member One', role: 'rider' };

function ride(id: string, tripId: string, seats: number, riders: string[] = []): TripRideDto {
	return {
		id,
		tripId,
		vehicle: {
			id: `vehicle-${id}`,
			status: 'published',
			name: `Vehicle ${id}`,
			vehicleType: 'Van',
			seats,
			primaryDriver: { id: 'driver-1', displayName: 'Driver One' }
		},
		occupiedSeats: riders.length,
		remainingSeats: seats - riders.length,
		riders: riders.map((id) => ({
			id,
			displayName: id === currentUser.id ? currentUser.displayName : 'Another Rider'
		}))
	};
}

function decision(
	id: string,
	direction: 'outbound' | 'return',
	tripRideId: string | null,
	updatedAt: string,
	decisionValue: 'ride' | 'opt_out'
): TransportationDecisionDto {
	return {
		id,
		eventId: 'event-1',
		userId: currentUser.id,
		direction,
		decision: decisionValue,
		tripRideId,
		updatedAt
	};
}

function details(): EventDetailsDto {
	return {
		event: {
			id: 'event-1',
			status: 'published',
			name: 'Regional Championship',
			description: null,
			startDate: '2026-11-10',
			endDate: '2026-11-12',
			location: 'Boston'
		},
		outbound: {
			trip: {
				id: 'trip-outbound',
				eventId: 'event-1',
				direction: 'outbound',
				status: 'published',
				destination: 'Boston',
				departsFrom: 'Waltham',
				departsOn: '2026-11-10',
				departsAt: '08:00',
				arrivesAt: '09:00'
			},
			rides: [ride('ride-outbound', 'trip-outbound', 2)]
		},
		return: {
			trip: {
				id: 'trip-return',
				eventId: 'event-1',
				direction: 'return',
				status: 'published',
				destination: 'Waltham',
				departsFrom: 'Boston',
				departsOn: '2026-11-12',
				departsAt: '17:00',
				arrivesAt: '18:00'
			},
			rides: [ride('ride-return', 'trip-return', 2)]
		},
		currentTransportation: { outbound: null, return: null }
	};
}

class FixtureEventRepository implements EventRepository {
	details: EventDetailsDto | null = details();

	async listPublished(): Promise<EventDetailsDto['event'][]> {
		return this.details ? [this.details.event] : [];
	}

	async getPublishedDetails(): Promise<EventDetailsDto | null> {
		return this.details;
	}
}

class FixtureTransportationRepository implements TransportationRepository {
	writes: TransportationUpdateInput[] = [];
	conflictOnWrite = false;

	constructor(private readonly events: FixtureEventRepository) {}

	async getCurrent(): Promise<TransportationDecisionDto[]> {
		const current = this.events.details?.currentTransportation;
		return [current?.outbound, current?.return].filter(
			(decision): decision is TransportationDecisionDto =>
				decision !== null && decision !== undefined
		);
	}

	async replaceCurrent(
		_eventId: string,
		userId: string,
		input: TransportationUpdateInput
	): Promise<void> {
		if (this.conflictOnWrite)
			throw new TransportationConflictError('A concurrent reservation won the seat.');
		this.writes.push(input);
		const current = this.events.details;
		if (!current) return;
		const version = `version-${this.writes.length}`;
		const updateDirection = (
			direction: 'outbound' | 'return',
			choice: TransportationUpdateInput['outbound']
		) => {
			const section = current[direction];
			for (const candidate of section.rides) {
				candidate.riders = candidate.riders.filter((rider) => rider.id !== userId);
				candidate.occupiedSeats = candidate.riders.length;
				candidate.remainingSeats = candidate.vehicle.seats - candidate.occupiedSeats;
			}
			return choice.decision === 'opt_out'
				? decision(`${direction}-decision`, direction, null, version, 'opt_out')
				: decision(`${direction}-decision`, direction, choice.tripRideId, version, 'ride');
		};
		current.currentTransportation = {
			outbound: updateDirection('outbound', input.outbound),
			return: updateDirection('return', input.return)
		};
		for (const [direction, choice] of [
			['outbound', input.outbound] as const,
			['return', input.return] as const
		]) {
			if (choice.decision === 'ride') {
				const selected = current[direction].rides.find(
					(candidate) => candidate.id === choice.tripRideId
				);
				if (selected) {
					selected.riders.push({ id: userId, displayName: currentUser.displayName });
					selected.occupiedSeats = selected.riders.length;
					selected.remainingSeats = selected.vehicle.seats - selected.occupiedSeats;
				}
			}
		}
	}
}

function serviceFixture(): {
	service: TransportationService;
	events: FixtureEventRepository;
	transportation: FixtureTransportationRepository;
} {
	const events = new FixtureEventRepository();
	const transportation = new FixtureTransportationRepository(events);
	return { service: new TransportationService(events, transportation), events, transportation };
}

describe('TransportationService', () => {
	it('saves one outbound ride and an explicit return opt-out atomically', async () => {
		const { service, events, transportation } = serviceFixture();

		const status = await service.replaceCurrent('event-1', currentUser, {
			outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
			return: { decision: 'opt_out', tripRideId: null },
			expectedUpdatedAt: null
		});

		expect(transportation.writes).toHaveLength(1);
		expect(status.outbound?.tripRideId).toBe('ride-outbound');
		expect(status.return?.decision).toBe('opt_out');
		expect(status.remainingSeats).toEqual([
			{ tripRideId: 'ride-outbound', remainingSeats: 1 },
			{ tripRideId: 'ride-return', remainingSeats: 2 }
		]);
		expect(events.details?.outbound.rides[0].riders).toHaveLength(1);
	});

	it('supports changing and clearing either direction with one complete payload', async () => {
		const { service, events } = serviceFixture();

		const first = await service.replaceCurrent('event-1', currentUser, {
			outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
			return: { decision: 'ride', tripRideId: 'ride-return' },
			expectedUpdatedAt: null
		});
		const second = await service.replaceCurrent('event-1', currentUser, {
			outbound: { decision: 'opt_out', tripRideId: null },
			return: { decision: 'opt_out', tripRideId: null },
			expectedUpdatedAt: first.return?.updatedAt ?? null
		});

		expect(second.outbound?.decision).toBe('opt_out');
		expect(second.return?.decision).toBe('opt_out');
		expect(events.details?.outbound.rides[0].riders).toHaveLength(0);
		expect(events.details?.return.rides[0].riders).toHaveLength(0);
	});

	it('rejects incomplete, duplicate, full, and stale transportation states', async () => {
		const { service, events, transportation } = serviceFixture();

		await expect(
			service.replaceCurrent('event-1', currentUser, {
				outbound: { decision: 'ride', tripRideId: 'ride-outbound' }
			})
		).rejects.toBeInstanceOf(DtoValidationError);
		await expect(
			service.replaceCurrent('event-1', currentUser, {
				outbound: { decision: 'opt_out', tripRideId: 'ride-outbound' },
				return: { decision: 'opt_out', tripRideId: null }
			})
		).rejects.toBeInstanceOf(DtoValidationError);

		events.details!.outbound.rides[0].remainingSeats = 0;
		await expect(
			service.replaceCurrent('event-1', currentUser, {
				outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
				return: { decision: 'opt_out', tripRideId: null },
				expectedUpdatedAt: null
			})
		).rejects.toBeInstanceOf(TransportationConflictError);
		events.details!.outbound.rides[0].remainingSeats = 2;
		events.details!.currentTransportation.outbound = decision(
			'outbound-decision',
			'outbound',
			'ride-outbound',
			'current-version',
			'ride'
		);
		await expect(
			service.replaceCurrent('event-1', currentUser, {
				outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
				return: { decision: 'opt_out', tripRideId: null },
				expectedUpdatedAt: 'stale-version'
			})
		).rejects.toBeInstanceOf(TransportationConflictError);
		expect(transportation.writes).toHaveLength(0);
	});

	it('rejects a duplicate existing rider and a concurrent seat conflict without partial writes', async () => {
		const { service, events, transportation } = serviceFixture();
		events.details!.outbound.rides[0].riders = [
			{ id: currentUser.id, displayName: currentUser.displayName },
			{ id: currentUser.id, displayName: currentUser.displayName }
		];

		await expect(
			service.replaceCurrent('event-1', currentUser, {
				outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
				return: { decision: 'opt_out', tripRideId: null }
			})
		).rejects.toBeInstanceOf(TransportationConflictError);

		events.details!.outbound.rides[0].riders = [];
		transportation.conflictOnWrite = true;
		await expect(
			service.replaceCurrent('event-1', currentUser, {
				outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
				return: { decision: 'opt_out', tripRideId: null },
				expectedUpdatedAt: null
			})
		).rejects.toBeInstanceOf(TransportationConflictError);
		expect(events.details?.currentTransportation.outbound).toBeNull();
	});
});
