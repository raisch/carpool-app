import type {
	CurrentUser,
	EventDetailsDto,
	TransportationStatusDto,
	TransportationUpdateInput
} from '#lib/domain/types';
import { parseTransportationUpdateInput, DtoValidationError } from '#lib/domain/validation';
import {
	IdentityUnavailableError,
	ResourceNotFoundError,
	TransportationConflictError
} from '../errors';
import type { EventRepository, TransportationRepository } from '../repositories/contracts';

function latestUpdatedAt(details: EventDetailsDto): string | null {
	return (
		[details.currentTransportation.outbound, details.currentTransportation.return]
			.filter((decision): decision is NonNullable<typeof decision> => decision !== null)
			.map((decision) => decision.updatedAt)
			.sort()
			.at(-1) ?? null
	);
}

function validateRideSelection(
	direction: 'outbound' | 'return',
	input: TransportationUpdateInput['outbound'],
	details: EventDetailsDto,
	currentUserId: string
): void {
	if (input.decision === 'opt_out') return;

	const section = details[direction];
	const ride = section.rides.find((candidate) => candidate.id === input.tripRideId);
	if (!ride || !section.trip) {
		throw new TransportationConflictError(
			`The selected ${direction} transportation option is no longer available.`
		);
	}

	const currentDecision = details.currentTransportation[direction];
	const isAlreadySelected = currentDecision?.tripRideId === ride.id;
	const currentUserAssignments = ride.riders.filter((rider) => rider.id === currentUserId).length;
	if (currentUserAssignments > 1) {
		throw new TransportationConflictError(
			`You are already listed more than once on the selected ${direction} ride.`
		);
	}
	if (ride.remainingSeats < 1 && !isAlreadySelected) {
		throw new TransportationConflictError(
			`The selected ${direction} vehicle is full. Refresh the event and choose another option.`
		);
	}
}

function statusFromDetails(details: EventDetailsDto): TransportationStatusDto {
	return {
		eventId: details.event.id,
		outbound: details.currentTransportation.outbound,
		return: details.currentTransportation.return,
		remainingSeats: [
			...details.outbound.rides.map((ride) => ({
				tripRideId: ride.id,
				remainingSeats: ride.remainingSeats
			})),
			...details.return.rides.map((ride) => ({
				tripRideId: ride.id,
				remainingSeats: ride.remainingSeats
			}))
		]
	};
}

export class TransportationService {
	constructor(
		private readonly events: EventRepository,
		private readonly transportation: TransportationRepository
	) {}

	async replaceCurrent(
		eventId: string,
		currentUser: CurrentUser | null,
		value: unknown
	): Promise<TransportationStatusDto> {
		if (!currentUser) throw new IdentityUnavailableError();

		let input: TransportationUpdateInput;
		try {
			input = parseTransportationUpdateInput(value);
		} catch (error) {
			if (error instanceof DtoValidationError) throw error;
			throw new DtoValidationError('Transportation status is invalid');
		}

		const details = await this.events.getPublishedDetails(eventId, currentUser);
		if (!details) throw new ResourceNotFoundError('Published event');

		if (
			input.expectedUpdatedAt !== undefined &&
			input.expectedUpdatedAt !== latestUpdatedAt(details)
		) {
			throw new TransportationConflictError(
				'This transportation status changed elsewhere. Refresh the event and try again.'
			);
		}

		validateRideSelection('outbound', input.outbound, details, currentUser.id);
		validateRideSelection('return', input.return, details, currentUser.id);

		await this.transportation.replaceCurrent(eventId, currentUser.id, input);
		const refreshed = await this.events.getPublishedDetails(eventId, currentUser);
		if (!refreshed) throw new ResourceNotFoundError('Published event');
		return statusFromDetails(refreshed);
	}
}
