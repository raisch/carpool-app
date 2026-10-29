import { describe, expect, it } from 'vitest';
import type {
	AdminUserDto,
	AdminEventDto,
	AdminTripDto,
	AdminTripRideDto,
	AdminVehicleDto,
	EventSummaryDto,
	TripDto,
	TripRideDto,
	VehicleDto
} from '#lib/domain/types';
import { AuthorizationError, ConflictError } from '../errors';
import type { AdminRepository } from '../repositories/contracts';
import { AdminService } from './admin-service';

const admin = { id: 'admin-1', displayName: 'Admin', role: 'admin' as const };
const driver = { id: 'driver-1', displayName: 'Driver One', role: 'driver' as const };
const otherDriver = { id: 'driver-2', displayName: 'Driver Two', role: 'driver' as const };
const rider = { id: 'rider-1', displayName: 'Rider One' };

const event: EventSummaryDto = {
	id: 'event-1',
	status: 'published',
	name: 'Regional Championship',
	description: null,
	startDate: '2026-11-10',
	endDate: '2026-11-12',
	location: 'Boston'
};

const trip: TripDto = {
	id: 'trip-1',
	eventId: event.id,
	direction: 'outbound',
	status: 'published',
	destination: 'Boston',
	departsFrom: 'Waltham',
	departsOn: event.startDate,
	departsAt: '08:00',
	arrivesAt: '09:00'
};

function vehicle(id: string, primaryDriver = driver, seats = 2): VehicleDto {
	return {
		id,
		status: 'published',
		name: `Vehicle ${id}`,
		vehicleType: 'Van',
		seats,
		primaryDriver
	};
}

function ride(id: string, currentVehicle: VehicleDto, riders = [rider]): TripRideDto {
	return {
		id,
		tripId: trip.id,
		vehicle: currentVehicle,
		occupiedSeats: riders.length,
		remainingSeats: currentVehicle.seats - riders.length,
		riders
	};
}

function fixture() {
	const ownVehicle = vehicle('vehicle-1');
	const otherVehicle = vehicle('vehicle-2', otherDriver);
	const ownRide = ride('ride-1', ownVehicle);
	const otherRide = ride('ride-2', otherVehicle, []);
	const adminTrip: AdminTripDto = { ...trip, rides: [ownRide, otherRide] };
	const adminEvent: AdminEventDto = { event, trips: [adminTrip] };
	const ownAdminVehicle: AdminVehicleDto = {
		vehicle: ownVehicle,
		assignments: [{ tripRideId: ownRide.id, trip, riders: ownRide.riders }]
	};
	const otherAdminVehicle: AdminVehicleDto = {
		vehicle: otherVehicle,
		assignments: [{ tripRideId: otherRide.id, trip, riders: [] }]
	};
	const profiles: AdminUserDto[] = [
		{
			...driver,
			role: 'driver',
			status: 'active',
			sourceSystem: 'wordpress',
			sourceUid: 'driver-1'
		},
		{
			...otherDriver,
			role: 'driver',
			status: 'active',
			sourceSystem: 'wordpress',
			sourceUid: 'driver-2'
		},
		{
			...rider,
			role: 'rider',
			status: 'active',
			sourceSystem: 'wordpress',
			sourceUid: 'rider-1'
		}
	];
	const repository = {
		listEvents: async () => [event],
		getEvent: async () => adminEvent,
		createEvent: async () => event,
		updateEvent: async () => event,
		deleteEvent: async () => undefined,
		getTrip: async () => adminTrip,
		createTrip: async () => trip,
		updateTrip: async () => trip,
		deleteTrip: async () => undefined,
		listVehicles: async () => [ownAdminVehicle, otherAdminVehicle],
		getVehicle: async (id: string) =>
			id === ownVehicle.id ? ownAdminVehicle : id === otherVehicle.id ? otherAdminVehicle : null,
		createVehicle: async () => ownVehicle,
		updateVehicle: async () => ownVehicle,
		deleteVehicle: async () => undefined,
		getTripRide: async (id: string): Promise<AdminTripRideDto | null> =>
			id === ownRide.id
				? { tripRide: ownRide, trip }
				: id === otherRide.id
					? { tripRide: otherRide, trip }
					: null,
		createTripRide: async () => ownRide,
		deleteTripRide: async () => undefined,
		addRider: async () => undefined,
		removeRider: async () => undefined,
		moveRider: async () => undefined,
		getUser: async (id: string) =>
			id === admin.id
				? {
						...admin,
						status: 'active' as const,
						sourceSystem: 'wordpress',
						sourceUid: admin.id
					}
				: (profiles.find((profile) => profile.id === id) ?? null),
		listUsers: async () => profiles,
		updateUser: async (id: string, input) => {
			const profile = profiles.find((value) => value.id === id);
			if (!profile) return null;
			profile.role = input.role;
			profile.status = input.status;
			return profile;
		},
		listDrivers: async () => profiles.filter((profile) => profile.role === 'driver'),
		listRiders: async () => profiles.filter((profile) => profile.role === 'rider')
	} satisfies AdminRepository;
	return {
		service: new AdminService(repository),
		repository,
		ownVehicle,
		otherVehicle,
		ownRide,
		otherRide
	};
}

describe('AdminService', () => {
	it('protects global administration from riders and drivers', async () => {
		const { service } = fixture();
		await expect(
			service.listEvents({ id: 'rider-1', displayName: 'Rider', role: 'rider' })
		).rejects.toBeInstanceOf(AuthorizationError);
		await expect(
			service.createEvent(driver, {
				status: 'draft',
				name: 'x',
				description: null,
				startDate: '2026-01-01',
				endDate: '2026-01-01',
				location: 'Boston'
			})
		).rejects.toBeInstanceOf(AuthorizationError);
	});

	it('allows admins to change roles and deactivate users', async () => {
		const { service } = fixture();

		await expect(
			service.updateUser(admin, rider.id, { role: 'driver', status: 'inactive' })
		).resolves.toMatchObject({ id: rider.id, role: 'driver', status: 'inactive' });
		await expect(service.listUsers(admin)).resolves.toHaveLength(3);
		await expect(
			service.updateUser({ ...rider, role: 'rider' }, driver.id, {
				role: 'rider',
				status: 'active'
			})
		).rejects.toBeInstanceOf(AuthorizationError);
	});

	it('protects the last active administrator and self-deactivation', async () => {
		const { service } = fixture();

		await expect(
			service.updateUser(admin, admin.id, { role: 'admin', status: 'inactive' })
		).rejects.toThrow('You cannot deactivate your own administrator account.');

		const onlyAdmin = {
			id: 'only-admin',
			displayName: 'Only Admin',
			role: 'admin' as const,
			status: 'active' as const,
			sourceSystem: 'wordpress',
			sourceUid: 'only-admin'
		};
		const repository = {
			...fixture().repository,
			getUser: async (id: string) => (id === onlyAdmin.id ? onlyAdmin : null),
			listUsers: async () => [onlyAdmin],
			updateUser: async () => onlyAdmin
		} satisfies AdminRepository;
		await expect(
			new AdminService(repository).updateUser(admin, onlyAdmin.id, {
				role: 'rider',
				status: 'active'
			})
		).rejects.toThrow('at least one active administrator');
	});

	it('scopes drivers to their own vehicle and allows permitted edits', async () => {
		const { service } = fixture();
		await expect(service.getVehicle(driver, 'vehicle-2')).rejects.toBeInstanceOf(
			AuthorizationError
		);
		await expect(
			service.updateVehicle(driver, 'vehicle-1', {
				status: 'published',
				name: 'Updated',
				vehicleType: 'Car',
				seats: 2,
				primaryDriverId: driver.id
			})
		).resolves.toEqual(expect.any(Object));
		await expect(
			service.updateVehicle(driver, 'vehicle-1', {
				status: 'published',
				name: 'Updated',
				vehicleType: 'Car',
				seats: 2,
				primaryDriverId: otherDriver.id
			})
		).rejects.toBeInstanceOf(AuthorizationError);
	});

	it('rejects capacity reductions and preserves dependent assignments', async () => {
		const { service, ownRide } = fixture();
		ownRide.riders.push({ id: 'rider-2', displayName: 'Rider Two' });
		await expect(
			service.updateVehicle(admin, 'vehicle-1', {
				status: 'published',
				name: 'Small',
				vehicleType: 'Car',
				seats: 0,
				primaryDriverId: driver.id
			})
		).rejects.toThrow('positive integer');
		await expect(
			service.updateVehicle(admin, 'vehicle-1', {
				status: 'published',
				name: 'Small',
				vehicleType: 'Car',
				seats: 1,
				primaryDriverId: driver.id
			})
		).rejects.toBeInstanceOf(ConflictError);
		await expect(service.deleteTrip(admin, trip.id)).rejects.toBeInstanceOf(ConflictError);
	});

	it('enforces one rider per direction and full-vehicle conflicts', async () => {
		const { service } = fixture();
		await expect(service.addRider(admin, 'ride-1', { userId: rider.id })).rejects.toBeInstanceOf(
			ConflictError
		);
		await expect(service.addRider(admin, 'ride-2', { userId: 'rider-1' })).rejects.toBeInstanceOf(
			ConflictError
		);
	});
});
