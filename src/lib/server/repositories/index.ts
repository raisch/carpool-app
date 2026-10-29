import { createDirectusClient } from '../directus/client';
import { createIdentityProvider, type IdentityProvider } from '../identity';
import type {
	AdminRepository,
	EventRepository,
	TransportationRepository,
	TripRepository,
	TripRideRepository,
	VehicleRepository
} from './contracts';
import { createDirectusRepositories } from './directus';
import { createNotConfiguredRepositories } from './not-configured';

export interface RepositoryDependencies {
	admin: AdminRepository;
	events: EventRepository;
	trips: TripRepository;
	vehicles: VehicleRepository;
	tripRides: TripRideRepository;
	transportation: TransportationRepository;
	identity: IdentityProvider;
}

export function createRepositories(): RepositoryDependencies {
	const client = createDirectusClient();
	if (!client) return createNotConfiguredRepositories();
	return { ...createDirectusRepositories(client), identity: createIdentityProvider() };
}
