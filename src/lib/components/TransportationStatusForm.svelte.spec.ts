import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { EventDetailsDto, IdentityState } from '#lib/domain/types';
import TransportationStatusForm from './TransportationStatusForm.svelte';

const configured: IdentityState = {
	status: 'configured',
	currentUser: { id: 'member-1', displayName: 'Member One', role: 'rider' }
};

const details: EventDetailsDto = {
	event: {
		id: 'event-1',
		status: 'published',
		name: 'Regional Championship',
		description: null,
		startDate: '2026-11-10',
		endDate: '2026-11-12',
		location: 'Boston'
	},
	outbound: {
		trip: {
			id: 'trip-outbound',
			eventId: 'event-1',
			direction: 'outbound',
			status: 'published',
			destination: 'Boston',
			departsFrom: 'Waltham',
			departsOn: '2026-11-10',
			departsAt: '08:00',
			arrivesAt: '09:00'
		},
		rides: [
			{
				id: 'ride-available',
				tripId: 'trip-outbound',
				vehicle: {
					id: 'vehicle-available',
					status: 'published',
					name: 'Blue van',
					vehicleType: 'Van',
					seats: 4,
					primaryDriver: { id: 'driver-1', displayName: 'Driver One' }
				},
				occupiedSeats: 2,
				remainingSeats: 2,
				riders: [{ id: 'rider-2', displayName: 'Rider Two' }]
			},
			{
				id: 'ride-full',
				tripId: 'trip-outbound',
				vehicle: {
					id: 'vehicle-full',
					status: 'published',
					name: 'Full car',
					vehicleType: 'Car',
					seats: 2,
					primaryDriver: { id: 'driver-2', displayName: 'Driver Two' }
				},
				occupiedSeats: 2,
				remainingSeats: 0,
				riders: [
					{ id: 'rider-2', displayName: 'Rider Two' },
					{ id: 'rider-3', displayName: 'Rider Three' }
				]
			}
		]
	},
	return: {
		trip: null,
		rides: []
	},
	currentTransportation: {
		outbound: {
			id: 'decision-outbound',
			eventId: 'event-1',
			userId: 'member-1',
			direction: 'outbound',
			decision: 'ride',
			tripRideId: 'ride-available',
			updatedAt: '2026-10-29T12:00:00Z'
		},
		return: null
	}
};

describe('TransportationStatusForm', () => {
	it('exposes available, full, and explicit opt-out states accessibly', async () => {
		render(TransportationStatusForm, { eventId: 'event-1', details, identity: configured });

		await expect
			.element(page.getByRole('heading', { name: 'Transportation status' }))
			.toBeVisible();
		await expect.element(page.getByText('Full', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('radio', { name: /Full car/ })).toBeDisabled();
		await expect
			.element(page.getByRole('button', { name: 'Save transportation status' }))
			.toBeEnabled();

		const outboundOptOut = page.getByLabelText('I do not need outbound transportation');
		await outboundOptOut.click();
		await expect.element(outboundOptOut).toBeChecked();
	});

	it('disables decisions while identity is unavailable', async () => {
		render(TransportationStatusForm, {
			eventId: 'event-1',
			details,
			identity: {
				status: 'not-configured',
				code: 'identity_not_configured',
				message: 'Identity integration is not configured yet.'
			}
		});

		await expect
			.element(page.getByRole('button', { name: 'Save transportation status' }))
			.toBeDisabled();
		await expect
			.element(page.getByLabelText('I do not need outbound transportation'))
			.toBeDisabled();
	});
});
