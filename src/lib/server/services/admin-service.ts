import type {
	AdminUserDto,
	AdminEventDto,
	AdminTripRideDto,
	AdminVehicleDto,
	EventSummaryDto,
	RiderMutationInput,
	TripDto,
	TripRideDto,
	UserProfileDto,
	VehicleDto
} from '#lib/domain/types';
import {
	parseEventMutationInput,
	parseRiderMutationInput,
	parseTripMutationInput,
	parseUserAdminMutationInput,
	parseVehicleMutationInput
} from '#lib/domain/validation';
import {
	AuthorizationError,
	ConflictError,
	IdentityUnavailableError,
	ResourceNotFoundError,
	ValidationError
} from '../errors';
import type { CurrentUser } from '../identity';
import type { AdminRepository } from '../repositories/contracts';

function currentUserOrThrow(currentUser: CurrentUser | null): CurrentUser {
	if (!currentUser) throw new IdentityUnavailableError();
	return currentUser;
}

function requireAdmin(currentUser: CurrentUser | null): CurrentUser {
	const user = currentUserOrThrow(currentUser);
	if (user.role !== 'admin') throw new AuthorizationError('Administrator access is required.');
	return user;
}

function requireAdminOrDriver(currentUser: CurrentUser | null): CurrentUser {
	const user = currentUserOrThrow(currentUser);
	if (user.role !== 'admin' && user.role !== 'driver') {
		throw new AuthorizationError('Administrator or driver access is required.');
	}
	return user;
}

function riderCount(ride: TripRideDto): number {
	return ride.riders.length;
}

function ensureCapacity(ride: TripRideDto): void {
	if (riderCount(ride) >= ride.vehicle.seats) {
		throw new ConflictError('The vehicle is full.');
	}
}

function ensureDriverProfile(profile: UserProfileDto | null, driverId: string): void {
	if (!profile || profile.status !== 'active' || profile.role !== 'driver') {
		throw new ValidationError(`User ${driverId} must be an active driver.`);
	}
}

export class AdminService {
	constructor(private readonly repository: AdminRepository) {}

	async listEvents(currentUser: CurrentUser | null): Promise<EventSummaryDto[]> {
		requireAdmin(currentUser);
		return this.repository.listEvents();
	}

	async getEvent(currentUser: CurrentUser | null, eventId: string): Promise<AdminEventDto> {
		requireAdmin(currentUser);
		const event = await this.repository.getEvent(eventId);
		if (!event) throw new ResourceNotFoundError('Event');
		return event;
	}

	async createEvent(currentUser: CurrentUser | null, value: unknown): Promise<EventSummaryDto> {
		requireAdmin(currentUser);
		return this.repository.createEvent(parseEventMutationInput(value));
	}

	async updateEvent(
		currentUser: CurrentUser | null,
		eventId: string,
		value: unknown
	): Promise<EventSummaryDto> {
		requireAdmin(currentUser);
		const result = await this.repository.updateEvent(eventId, parseEventMutationInput(value));
		if (!result) throw new ResourceNotFoundError('Event');
		return result;
	}

	async deleteEvent(currentUser: CurrentUser | null, eventId: string): Promise<void> {
		requireAdmin(currentUser);
		const event = await this.repository.getEvent(eventId);
		if (!event) throw new ResourceNotFoundError('Event');
		if (event.trips.some((trip) => trip.rides.some((ride) => ride.riders.length > 0))) {
			throw new ConflictError('The event has active riders; archive it or clean up riders first.');
		}
		for (const trip of event.trips) {
			for (const ride of trip.rides) await this.repository.deleteTripRide(ride.id);
		}
		await this.repository.deleteEvent(eventId);
	}

	async createTrip(currentUser: CurrentUser | null, value: unknown): Promise<TripDto> {
		requireAdmin(currentUser);
		const input = parseTripMutationInput(value);
		if (!(await this.repository.getEvent(input.eventId))) {
			throw new ResourceNotFoundError('Event');
		}
		return this.repository.createTrip(input);
	}

	async updateTrip(
		currentUser: CurrentUser | null,
		tripId: string,
		value: unknown
	): Promise<TripDto> {
		requireAdmin(currentUser);
		const current = await this.repository.getTrip(tripId);
		if (!current) throw new ResourceNotFoundError('Trip');
		const input = parseTripMutationInput(value);
		if (input.direction !== current.direction) {
			throw new ValidationError('A trip direction cannot be changed after creation.');
		}
		if (!(await this.repository.getEvent(input.eventId))) {
			throw new ResourceNotFoundError('Event');
		}
		const result = await this.repository.updateTrip(tripId, input);
		if (!result) throw new ResourceNotFoundError('Trip');
		return result;
	}

	async deleteTrip(currentUser: CurrentUser | null, tripId: string): Promise<void> {
		requireAdmin(currentUser);
		const trip = await this.repository.getTrip(tripId);
		if (!trip) throw new ResourceNotFoundError('Trip');
		if (trip.rides.some((ride) => ride.riders.length > 0)) {
			throw new ConflictError('The trip has riders; remove or move them before deleting it.');
		}
		for (const ride of trip.rides) await this.repository.deleteTripRide(ride.id);
		await this.repository.deleteTrip(tripId);
	}

	async listVehicles(currentUser: CurrentUser | null): Promise<AdminVehicleDto[]> {
		const user = requireAdminOrDriver(currentUser);
		const vehicles = await this.repository.listVehicles();
		return user.role === 'admin'
			? vehicles
			: vehicles.filter((entry) => entry.vehicle.primaryDriver.id === user.id);
	}

	async getVehicle(currentUser: CurrentUser | null, vehicleId: string): Promise<AdminVehicleDto> {
		const user = requireAdminOrDriver(currentUser);
		const vehicle = await this.repository.getVehicle(vehicleId);
		if (!vehicle) throw new ResourceNotFoundError('Vehicle');
		if (user.role !== 'admin' && vehicle.vehicle.primaryDriver.id !== user.id) {
			throw new AuthorizationError('Drivers may only access their own vehicle.');
		}
		return vehicle;
	}

	async createVehicle(currentUser: CurrentUser | null, value: unknown): Promise<VehicleDto> {
		requireAdmin(currentUser);
		const input = parseVehicleMutationInput(value);
		ensureDriverProfile(
			await this.repository.getUser(input.primaryDriverId),
			input.primaryDriverId
		);
		return this.repository.createVehicle(input);
	}

	async updateVehicle(
		currentUser: CurrentUser | null,
		vehicleId: string,
		value: unknown
	): Promise<VehicleDto> {
		const user = requireAdminOrDriver(currentUser);
		const current = await this.repository.getVehicle(vehicleId);
		if (!current) throw new ResourceNotFoundError('Vehicle');
		const input = parseVehicleMutationInput(value);
		if (user.role !== 'admin') {
			if (current.vehicle.primaryDriver.id !== user.id) {
				throw new AuthorizationError('Drivers may only edit their own vehicle.');
			}
			if (input.primaryDriverId !== user.id || input.status !== current.vehicle.status) {
				throw new AuthorizationError('Drivers cannot change vehicle ownership or lifecycle.');
			}
		} else {
			ensureDriverProfile(
				await this.repository.getUser(input.primaryDriverId),
				input.primaryDriverId
			);
		}
		const riders = current.assignments.flatMap((assignment) => assignment.riders);
		if (input.seats < riders.length) {
			throw new ConflictError(`Capacity cannot be reduced below ${riders.length} current riders.`);
		}
		const result = await this.repository.updateVehicle(vehicleId, input);
		if (!result) throw new ResourceNotFoundError('Vehicle');
		return result;
	}

	async deleteVehicle(currentUser: CurrentUser | null, vehicleId: string): Promise<void> {
		requireAdmin(currentUser);
		const vehicle = await this.repository.getVehicle(vehicleId);
		if (!vehicle) throw new ResourceNotFoundError('Vehicle');
		if (vehicle.assignments.some((assignment) => assignment.riders.length > 0)) {
			throw new ConflictError('The vehicle has riders; remove them before deleting it.');
		}
		for (const assignment of vehicle.assignments) {
			await this.repository.deleteTripRide(assignment.tripRideId);
		}
		await this.repository.deleteVehicle(vehicleId);
	}

	async assignVehicle(
		currentUser: CurrentUser | null,
		tripId: string,
		vehicleId: string
	): Promise<TripRideDto> {
		requireAdmin(currentUser);
		const trip = await this.repository.getTrip(tripId);
		if (!trip) throw new ResourceNotFoundError('Trip');
		const vehicle = await this.repository.getVehicle(vehicleId);
		if (!vehicle) throw new ResourceNotFoundError('Vehicle');
		if (vehicle.vehicle.status !== 'published') {
			throw new ValidationError('Only published vehicles can be assigned to trips.');
		}
		if (trip.rides.some((ride) => ride.vehicle.id === vehicleId)) {
			throw new ConflictError('This vehicle is already assigned to the trip.');
		}
		return this.repository.createTripRide(tripId, vehicleId);
	}

	async unassignVehicle(currentUser: CurrentUser | null, tripRideId: string): Promise<void> {
		requireAdmin(currentUser);
		const ride = await this.repository.getTripRide(tripRideId);
		if (!ride) throw new ResourceNotFoundError('Trip assignment');
		if (ride.tripRide.riders.length > 0) {
			throw new ConflictError('Remove or move riders before removing this assignment.');
		}
		await this.repository.deleteTripRide(tripRideId);
	}

	private async riderOperationContext(
		currentUser: CurrentUser | null,
		tripRideId: string
	): Promise<{ user: CurrentUser; ride: AdminTripRideDto }> {
		const user = requireAdminOrDriver(currentUser);
		const ride = await this.repository.getTripRide(tripRideId);
		if (!ride) throw new ResourceNotFoundError('Trip assignment');
		if (user.role !== 'admin' && ride.tripRide.vehicle.primaryDriver.id !== user.id) {
			throw new AuthorizationError('Drivers may only manage riders on their own vehicle.');
		}
		return { user, ride };
	}

	private async parseRider(
		value: unknown
	): Promise<RiderMutationInput & { profile: UserProfileDto }> {
		const input = parseRiderMutationInput(value);
		const profile = await this.repository.getUser(input.userId);
		if (!profile || profile.status !== 'active') throw new ResourceNotFoundError('Rider');
		return { ...input, profile };
	}

	private async existingRiderOnDirection(
		eventId: string,
		direction: 'outbound' | 'return',
		userId: string
	): Promise<AdminTripRideDto | null> {
		const event = await this.repository.getEvent(eventId);
		if (!event) throw new ResourceNotFoundError('Event');
		for (const trip of event.trips.filter((candidate) => candidate.direction === direction)) {
			const ride = trip.rides.find((candidate) =>
				candidate.riders.some((rider) => rider.id === userId)
			);
			if (ride) return { tripRide: ride, trip };
		}
		return null;
	}

	async addRider(
		currentUser: CurrentUser | null,
		tripRideId: string,
		value: unknown
	): Promise<void> {
		const { ride } = await this.riderOperationContext(currentUser, tripRideId);
		const { userId } = await this.parseRider(value);
		if (ride.tripRide.riders.some((rider) => rider.id === userId)) {
			throw new ConflictError('This rider is already assigned to the trip.');
		}
		const existing = await this.existingRiderOnDirection(
			ride.trip.eventId,
			ride.trip.direction,
			userId
		);
		if (existing && existing.tripRide.id !== tripRideId) {
			throw new ConflictError('A rider can only have one assignment per direction.');
		}
		ensureCapacity(ride.tripRide);
		await this.repository.addRider(tripRideId, userId);
	}

	async removeRider(
		currentUser: CurrentUser | null,
		tripRideId: string,
		value: unknown
	): Promise<void> {
		await this.riderOperationContext(currentUser, tripRideId);
		const { userId } = await this.parseRider(value);
		await this.repository.removeRider(tripRideId, userId);
	}

	async moveRider(
		currentUser: CurrentUser | null,
		tripRideId: string,
		value: unknown
	): Promise<void> {
		const { ride: source } = await this.riderOperationContext(currentUser, tripRideId);
		const { userId, destinationTripRideId } = await this.parseRider(value);
		if (!destinationTripRideId)
			throw new ValidationError('destinationTripRideId is required to move a rider.');
		const destination = await this.repository.getTripRide(destinationTripRideId);
		if (!destination) throw new ResourceNotFoundError('Destination trip assignment');
		if (
			source.trip.direction !== destination.trip.direction ||
			source.trip.eventId !== destination.trip.eventId
		) {
			throw new ValidationError('Riders can only move within the same event direction.');
		}
		if (source.tripRide.id === destination.tripRide.id) {
			throw new ValidationError('The destination assignment must be different.');
		}
		if (
			currentUser?.role !== 'admin' &&
			destination.tripRide.vehicle.primaryDriver.id !== currentUser?.id
		) {
			throw new AuthorizationError('Drivers may only move riders within their own vehicle.');
		}
		if (!source.tripRide.riders.some((rider) => rider.id === userId)) {
			throw new ResourceNotFoundError('Rider assignment');
		}
		if (destination.tripRide.riders.some((rider) => rider.id === userId)) {
			throw new ConflictError('The rider is already assigned to the destination.');
		}
		ensureCapacity(destination.tripRide);
		await this.repository.moveRider(source.tripRide.id, destination.tripRide.id, userId);
	}

	async listDrivers(currentUser: CurrentUser | null): Promise<UserProfileDto[]> {
		requireAdmin(currentUser);
		return this.repository.listDrivers();
	}

	async listRiders(currentUser: CurrentUser | null): Promise<UserProfileDto[]> {
		requireAdminOrDriver(currentUser);
		return this.repository.listRiders();
	}

	async listUsers(currentUser: CurrentUser | null): Promise<AdminUserDto[]> {
		requireAdmin(currentUser);
		return this.repository.listUsers();
	}

	async updateUser(
		currentUser: CurrentUser | null,
		userId: string,
		value: unknown
	): Promise<UserProfileDto> {
		const admin = requireAdmin(currentUser);
		if (!userId.trim()) throw new ValidationError('A user ID is required.');
		const input = parseUserAdminMutationInput(value);
		const current = await this.repository.getUser(userId);
		if (!current) throw new ResourceNotFoundError('User');

		if (admin.id === current.id && input.status === 'inactive') {
			throw new ConflictError('You cannot deactivate your own administrator account.');
		}

		if (
			current.status === 'active' &&
			current.role === 'admin' &&
			(input.status === 'inactive' || input.role !== 'admin')
		) {
			const activeAdmins = (await this.repository.listUsers()).filter(
				(user) => user.status === 'active' && user.role === 'admin'
			);
			if (activeAdmins.length <= 1) {
				throw new ConflictError('The carpool must retain at least one active administrator.');
			}
		}

		const updated = await this.repository.updateUser(userId, input);
		if (!updated) throw new ResourceNotFoundError('User');
		return updated;
	}
}
