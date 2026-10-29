import type {
	AdminEventDto,
	AdminTripDto,
	AdminTripRideDto,
	AdminVehicleDto,
	AdminUserDto,
	EventDetailsDto,
	EventMutationInput,
	EventSummaryDto,
	UserAdminMutationInput,
	TransportationUpdateInput,
	TransportationDecisionDto,
	TripMutationInput,
	TripDto,
	TripRideDto,
	UserProfileDto,
	VehicleDto,
	VehicleMutationInput
} from '#lib/domain/types';
import type { CurrentUser } from '../identity';

export interface EventRepository {
	listPublished(): Promise<EventSummaryDto[]>;
	getPublishedDetails(
		eventId: string,
		currentUser: CurrentUser | null
	): Promise<EventDetailsDto | null>;
}

export interface TripRepository {
	getById(tripId: string): Promise<TripDto | null>;
}

export interface VehicleRepository {
	listVisible(currentUser: CurrentUser | null): Promise<VehicleDto[]>;
}

export interface TripRideRepository {
	getById(tripRideId: string): Promise<TripRideDto | null>;
}

export interface TransportationRepository {
	getCurrent(eventId: string, userId: string): Promise<TransportationDecisionDto[]>;
	replaceCurrent(eventId: string, userId: string, input: TransportationUpdateInput): Promise<void>;
}

export interface AdminRepository {
	listEvents(): Promise<EventSummaryDto[]>;
	getEvent(eventId: string): Promise<AdminEventDto | null>;
	createEvent(input: EventMutationInput): Promise<EventSummaryDto>;
	updateEvent(eventId: string, input: EventMutationInput): Promise<EventSummaryDto | null>;
	deleteEvent(eventId: string): Promise<void>;

	getTrip(tripId: string): Promise<AdminTripDto | null>;
	createTrip(input: TripMutationInput): Promise<TripDto>;
	updateTrip(tripId: string, input: TripMutationInput): Promise<TripDto | null>;
	deleteTrip(tripId: string): Promise<void>;

	listVehicles(): Promise<AdminVehicleDto[]>;
	getVehicle(vehicleId: string): Promise<AdminVehicleDto | null>;
	createVehicle(input: VehicleMutationInput): Promise<VehicleDto>;
	updateVehicle(vehicleId: string, input: VehicleMutationInput): Promise<VehicleDto | null>;
	deleteVehicle(vehicleId: string): Promise<void>;

	getTripRide(tripRideId: string): Promise<AdminTripRideDto | null>;
	createTripRide(tripId: string, vehicleId: string): Promise<TripRideDto>;
	deleteTripRide(tripRideId: string): Promise<void>;
	addRider(tripRideId: string, userId: string): Promise<void>;
	removeRider(tripRideId: string, userId: string): Promise<void>;
	moveRider(sourceTripRideId: string, destinationTripRideId: string, userId: string): Promise<void>;

	getUser(userId: string): Promise<UserProfileDto | null>;
	listUsers(): Promise<AdminUserDto[]>;
	updateUser(userId: string, input: UserAdminMutationInput): Promise<UserProfileDto | null>;
	listDrivers(): Promise<UserProfileDto[]>;
	listRiders(): Promise<UserProfileDto[]>;
}
