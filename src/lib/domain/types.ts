export type Role = 'rider' | 'driver' | 'admin';

export type UserStatus = 'active' | 'inactive';

export type LifecycleStatus = 'draft' | 'published' | 'archived';

export type Direction = 'outbound' | 'return';

export type TransportationDecision = 'ride' | 'opt_out';

export interface TransportationDecisionInput {
	decision: TransportationDecision;
	tripRideId: string | null;
}

export interface TransportationUpdateInput {
	outbound: TransportationDecisionInput;
	return: TransportationDecisionInput;
	/** The latest version the member saw; null means no prior decision existed. */
	expectedUpdatedAt?: string | null;
}

export interface TransportationStatusDto {
	eventId: string;
	outbound: TransportationDecisionDto | null;
	return: TransportationDecisionDto | null;
	remainingSeats: Array<{ tripRideId: string; remainingSeats: number }>;
}

export interface CurrentUser {
	id: string;
	displayName: string;
	role: Role;
}

export type IdentityState =
	| { status: 'configured'; currentUser: CurrentUser }
	| {
			status: 'unauthenticated';
			code: 'not_authenticated';
			message: string;
	  }
	| {
			status: 'not-configured';
			code: 'identity_not_configured';
			message: string;
	  };

export interface UserReferenceDto {
	id: string;
	displayName: string;
}

export interface UserProfileDto extends UserReferenceDto {
	role: Role;
	status: UserStatus;
}

export interface AdminUserDto extends UserProfileDto {
	sourceSystem: string;
	sourceUid: string;
}

export interface UserAdminMutationInput {
	role: Role;
	status: UserStatus;
}

export interface EventSummaryDto {
	id: string;
	status: LifecycleStatus;
	name: string;
	description: string | null;
	startDate: string;
	endDate: string;
	location: string;
}

export interface EventMutationInput {
	status: LifecycleStatus;
	name: string;
	description: string | null;
	startDate: string;
	endDate: string;
	location: string;
}

export interface TripDto {
	id: string;
	eventId: string;
	direction: Direction;
	status: LifecycleStatus;
	destination: string;
	departsFrom: string;
	departsOn: string;
	departsAt: string;
	arrivesAt: string | null;
}

export interface TripMutationInput {
	eventId: string;
	direction: Direction;
	status: LifecycleStatus;
	destination: string;
	departsFrom: string;
	departsOn: string;
	departsAt: string;
	arrivesAt: string | null;
}

export interface VehicleDto {
	id: string;
	status: LifecycleStatus;
	name: string;
	vehicleType: string;
	seats: number;
	primaryDriver: UserReferenceDto;
}

export interface VehicleMutationInput {
	status: LifecycleStatus;
	name: string;
	vehicleType: string;
	seats: number;
	primaryDriverId: string;
}

export interface TripRideDto {
	id: string;
	tripId: string;
	vehicle: VehicleDto;
	occupiedSeats: number;
	remainingSeats: number;
	riders: UserReferenceDto[];
}

export interface AdminTripDto extends TripDto {
	rides: TripRideDto[];
}

export interface AdminEventDto {
	event: EventSummaryDto;
	trips: AdminTripDto[];
}

export interface AdminTripRideDto {
	tripRide: TripRideDto;
	trip: TripDto;
}

export interface VehicleAssignmentDto {
	tripRideId: string;
	trip: TripDto;
	riders: UserReferenceDto[];
}

export interface AdminVehicleDto {
	vehicle: VehicleDto;
	assignments: VehicleAssignmentDto[];
}

export interface RiderMutationInput {
	userId: string;
	destinationTripRideId?: string;
}

export interface TransportationDecisionDto {
	id: string;
	eventId: string;
	userId: string;
	direction: Direction;
	decision: TransportationDecision;
	tripRideId: string | null;
	updatedAt: string;
}

export interface EventDetailsDto {
	event: EventSummaryDto;
	outbound: {
		trip: TripDto | null;
		rides: TripRideDto[];
	};
	return: {
		trip: TripDto | null;
		rides: TripRideDto[];
	};
	currentTransportation: {
		outbound: TransportationDecisionDto | null;
		return: TransportationDecisionDto | null;
	};
}
