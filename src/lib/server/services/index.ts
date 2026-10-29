import { EventService } from './event-service';
import { createRepositories } from '../repositories';
import { AdminService } from './admin-service';
import { TransportationService } from './transportation-service';
import { ExportService } from './export-service';

export { AdminService } from './admin-service';
export { ExportService } from './export-service';

export function createEventService(): EventService {
	return new EventService(createRepositories().events);
}

export function createTransportationService(): TransportationService {
	const repositories = createRepositories();
	return new TransportationService(repositories.events, repositories.transportation);
}

export function createAdminService(): AdminService {
	return new AdminService(createRepositories().admin);
}

export function createExportService(): ExportService {
	return new ExportService(createRepositories().admin);
}
