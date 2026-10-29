import { describe, expect, it } from 'vitest';
import { BackendUnavailableError } from '../errors';
import { NotConfiguredEventRepository } from '../repositories/not-configured';
import { EventService } from './event-service';

describe('EventService', () => {
	it('preserves backend failures instead of presenting them as an empty list', async () => {
		await expect(
			new EventService(new NotConfiguredEventRepository()).listActiveEvents()
		).rejects.toBeInstanceOf(BackendUnavailableError);
	});
});
