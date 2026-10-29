import type { EventDetailsDto, EventSummaryDto } from '#lib/domain/types';
import type { CurrentUser } from '../identity';
import type { EventRepository } from '../repositories/contracts';

export class EventService {
	constructor(private readonly repository: EventRepository) {}

	listActiveEvents(): Promise<EventSummaryDto[]> {
		return this.repository.listPublished();
	}

	getPublishedEvent(
		eventId: string,
		currentUser: CurrentUser | null
	): Promise<EventDetailsDto | null> {
		return this.repository.getPublishedDetails(eventId, currentUser);
	}
}
