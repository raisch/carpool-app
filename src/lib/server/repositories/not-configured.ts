import { BackendUnavailableError } from '../errors';
import type { IdentityProvider } from '../identity';
import { createIdentityProvider } from '../identity';
import type {
	AdminRepository,
	EventRepository,
	TripRepository,
	TripRideRepository,
	TransportationRepository,
	VehicleRepository
} from './contracts';

class NotConfiguredAdminRepository implements AdminRepository {
	private unavailable(): never {
		throw new BackendUnavailableError('Directus administrative repository is not configured yet.');
	}
	listEvents(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	getEvent(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	createEvent(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	updateEvent(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	deleteEvent(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	getTrip(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	createTrip(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	updateTrip(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	deleteTrip(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	listVehicles(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	getVehicle(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	createVehicle(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	updateVehicle(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	deleteVehicle(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	getTripRide(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	createTripRide(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	deleteTripRide(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	addRider(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	removeRider(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	moveRider(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	getUser(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	listUsers(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	updateUser(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	listDrivers(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
	listRiders(): Promise<never> {
		return Promise.reject(this.unavailable());
	}
}

export class NotConfiguredEventRepository implements EventRepository {
	async listPublished(): Promise<never> {
		throw new BackendUnavailableError('Directus event repository is not configured yet.');
	}

	async getPublishedDetails(): Promise<never> {
		throw new BackendUnavailableError('Directus event repository is not configured yet.');
	}
}

export class NotConfiguredTripRepository implements TripRepository {
	async getById(): Promise<never> {
		throw new BackendUnavailableError('Directus trip repository is not configured yet.');
	}
}

export class NotConfiguredVehicleRepository implements VehicleRepository {
	async listVisible(): Promise<never> {
		throw new BackendUnavailableError('Directus vehicle repository is not configured yet.');
	}
}

export class NotConfiguredTripRideRepository implements TripRideRepository {
	async getById(): Promise<never> {
		throw new BackendUnavailableError('Directus trip-ride repository is not configured yet.');
	}
}

export class NotConfiguredTransportationRepository implements TransportationRepository {
	async getCurrent(): Promise<never> {
		throw new BackendUnavailableError('Directus transportation repository is not configured yet.');
	}

	async replaceCurrent(): Promise<never> {
		throw new BackendUnavailableError('Directus transportation repository is not configured yet.');
	}
}

export interface RepositoryDependencies {
	admin: AdminRepository;
	events: EventRepository;
	trips: TripRepository;
	vehicles: VehicleRepository;
	tripRides: TripRideRepository;
	transportation: TransportationRepository;
	identity: IdentityProvider;
}

export function createNotConfiguredRepositories(): RepositoryDependencies {
	return {
		admin: new NotConfiguredAdminRepository(),
		events: new NotConfiguredEventRepository(),
		trips: new NotConfiguredTripRepository(),
		vehicles: new NotConfiguredVehicleRepository(),
		tripRides: new NotConfiguredTripRideRepository(),
		transportation: new NotConfiguredTransportationRepository(),
		identity: createIdentityProvider()
	};
}
