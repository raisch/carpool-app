import type { AdminEventDto } from '#lib/domain/types';
import { AuthorizationError, IdentityUnavailableError, ResourceNotFoundError } from '../errors';
import type { CurrentUser } from '../identity';
import type { AdminRepository } from '../repositories/contracts';

function requireAdmin(currentUser: CurrentUser | null): void {
	if (!currentUser) throw new IdentityUnavailableError();
	if (currentUser.role !== 'admin') {
		throw new AuthorizationError('Administrator access is required for event exports.');
	}
}

export class ExportService {
	constructor(private readonly repository: AdminRepository) {}

	async getEvent(currentUser: CurrentUser | null, eventId: string): Promise<AdminEventDto> {
		requireAdmin(currentUser);
		const event = await this.repository.getEvent(eventId);
		if (!event) throw new ResourceNotFoundError('Event');
		return event;
	}
}
