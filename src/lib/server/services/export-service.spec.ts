import { describe, expect, it } from 'vitest';
import { AuthorizationError, IdentityUnavailableError, ResourceNotFoundError } from '../errors';
import type { AdminRepository } from '../repositories/contracts';
import { ExportService } from './export-service';

const repository = {
	getEvent: async () => null
} as unknown as AdminRepository;

describe('ExportService', () => {
	it('requires a configured administrator before reading event data', async () => {
		const service = new ExportService(repository);
		await expect(service.getEvent(null, 'event-1')).rejects.toBeInstanceOf(
			IdentityUnavailableError
		);
		await expect(
			service.getEvent({ id: 'rider-1', displayName: 'Rider', role: 'rider' }, 'event-1')
		).rejects.toBeInstanceOf(AuthorizationError);
	});

	it('returns a not-found error for an administrator outside the event scope', async () => {
		await expect(
			new ExportService(repository).getEvent(
				{ id: 'admin-1', displayName: 'Admin', role: 'admin' },
				'event-1'
			)
		).rejects.toBeInstanceOf(ResourceNotFoundError);
	});
});
