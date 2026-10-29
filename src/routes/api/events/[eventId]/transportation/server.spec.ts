import { describe, expect, it } from 'vitest';
import type {
	EventDetailsDto,
	EventSummaryDto,
	TransportationDecisionDto,
	TransportationUpdateInput
} from '#lib/domain/types';
import type { IdentityProvider } from '#lib/server/identity';
import type { EventRepository, TransportationRepository } from '#lib/server/repositories/contracts';
import { TransportationConflictError } from '#lib/server/errors';
import { createPutHandler } from '#lib/server/transportation-handler';

const event: EventSummaryDto = {
	id: 'event-1',
	status: 'published',
	name: 'Regional Championship',
	description: null,
	startDate: '2026-11-10',
	endDate: '2026-11-12',
	location: 'Boston'
};

function eventDetails(): EventDetailsDto {
	const vehicle = {
		id: 'vehicle-1',
		status: 'published' as const,
		name: 'Blue van',
		vehicleType: 'Van',
		seats: 4,
		primaryDriver: { id: 'driver-1', displayName: 'Driver One' }
	};
	return {
		event,
		outbound: {
			trip: {
				id: 'trip-outbound',
				eventId: event.id,
				direction: 'outbound',
				status: 'published',
				destination: event.location,
				departsFrom: 'Waltham',
				departsOn: event.startDate,
				departsAt: '08:00',
				arrivesAt: '09:00'
			},
			rides: [
				{
					id: 'ride-outbound',
					tripId: 'trip-outbound',
					vehicle,
					occupiedSeats: 0,
					remainingSeats: 4,
					riders: []
				}
			]
		},
		return: { trip: null, rides: [] },
		currentTransportation: { outbound: null, return: null }
	};
}

class FixtureEvents implements EventRepository {
	details: EventDetailsDto | null = eventDetails();

	async listPublished(): Promise<EventSummaryDto[]> {
		return this.details ? [this.details.event] : [];
	}

	async getPublishedDetails(): Promise<EventDetailsDto | null> {
		return this.details;
	}
}

class FixtureTransportation implements TransportationRepository {
	input: TransportationUpdateInput | null = null;
	conflict = false;

	async getCurrent(): Promise<TransportationDecisionDto[]> {
		return [];
	}

	async replaceCurrent(
		_eventId: string,
		_userId: string,
		input: TransportationUpdateInput
	): Promise<void> {
		if (this.conflict)
			throw new TransportationConflictError('The seat was taken by another member.');
		this.input = input;
	}
}

function requestFor(
	payload: string,
	eventId = 'event-1'
): Parameters<ReturnType<typeof createPutHandler>>[0] {
	return {
		params: { eventId },
		request: new Request('http://localhost/api/events/event-1/transportation', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: payload
		})
	} as Parameters<ReturnType<typeof createPutHandler>>[0];
}

function dependencies(
	identity: IdentityProvider,
	events: FixtureEvents,
	transportation: FixtureTransportation
) {
	return { identity, events, transportation };
}

const configuredIdentity: IdentityProvider = {
	async getCurrentUser() {
		return {
			status: 'configured',
			currentUser: { id: 'member-1', displayName: 'Member One', role: 'rider' }
		};
	}
};

describe('PUT /api/events/[eventId]/transportation', () => {
	it('returns 400 for malformed and incomplete payloads', async () => {
		const events = new FixtureEvents();
		const transportation = new FixtureTransportation();
		const handler = createPutHandler(dependencies(configuredIdentity, events, transportation));

		expect((await handler(requestFor('{'))).status).toBe(400);
		expect(
			(
				await handler(
					requestFor(JSON.stringify({ outbound: { decision: 'opt_out', tripRideId: null } }))
				)
			).status
		).toBe(400);
	});

	it('returns 401 when identity is unavailable', async () => {
		const notConfigured: IdentityProvider = {
			async getCurrentUser() {
				return {
					status: 'not-configured',
					code: 'identity_not_configured',
					message: 'Identity integration is not configured yet.'
				};
			}
		};
		const handler = createPutHandler(
			dependencies(notConfigured, new FixtureEvents(), new FixtureTransportation())
		);

		const response = await handler(
			requestFor(
				JSON.stringify({
					outbound: { decision: 'opt_out', tripRideId: null },
					return: { decision: 'opt_out', tripRideId: null }
				})
			)
		);
		expect(response.status).toBe(401);
	});

	it('returns 404 for a missing published event', async () => {
		const events = new FixtureEvents();
		events.details = null;
		const handler = createPutHandler(
			dependencies(configuredIdentity, events, new FixtureTransportation())
		);

		const response = await handler(
			requestFor(
				JSON.stringify({
					outbound: { decision: 'opt_out', tripRideId: null },
					return: { decision: 'opt_out', tripRideId: null }
				})
			)
		);
		expect(response.status).toBe(404);
	});

	it('returns 409 for an atomic conflict and 200 with normalized status on success', async () => {
		const events = new FixtureEvents();
		const transportation = new FixtureTransportation();
		const handler = createPutHandler(dependencies(configuredIdentity, events, transportation));
		const payload = JSON.stringify({
			outbound: { decision: 'ride', tripRideId: 'ride-outbound' },
			return: { decision: 'opt_out', tripRideId: null },
			expectedUpdatedAt: null
		});

		transportation.conflict = true;
		expect((await handler(requestFor(payload))).status).toBe(409);

		transportation.conflict = false;
		const response = await handler(requestFor(payload));
		expect(response.status).toBe(200);
		expect(transportation.input).toEqual(JSON.parse(payload));
		expect(await response.json()).toMatchObject({
			status: { eventId: 'event-1', outbound: null, return: null }
		});
	});
});
