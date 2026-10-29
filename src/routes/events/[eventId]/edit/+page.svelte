<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminEventForm from '#lib/components/AdminEventForm.svelte';
	import AdminTripForm from '#lib/components/AdminTripForm.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let assignmentVehicle = $state<Record<string, string>>({});
	let feedback = $state('');

	async function assign(tripId: string): Promise<void> {
		const vehicleId = assignmentVehicle[tripId];
		if (!vehicleId) return;
		const response = await fetch(resolve('/api/trips'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tripId, vehicleId })
		});
		feedback = response.ok
			? 'Vehicle assigned.'
			: await message(response, 'Vehicle assignment failed.');
		if (response.ok) await invalidateAll();
	}

	async function unassign(tripRideId: string): Promise<void> {
		const response = await fetch(
			`${resolve('/api/trips')}?tripRideId=${encodeURIComponent(tripRideId)}`,
			{ method: 'DELETE' }
		);
		feedback = response.ok
			? 'Vehicle unassigned.'
			: await message(response, 'Vehicle unassignment failed.');
		if (response.ok) await invalidateAll();
	}

	async function message(response: Response, fallback: string): Promise<string> {
		try {
			const body: unknown = await response.json();
			if (
				typeof body === 'object' &&
				body !== null &&
				'error' in body &&
				typeof body.error === 'object' &&
				body.error !== null &&
				'message' in body.error &&
				typeof body.error.message === 'string'
			)
				return body.error.message;
		} catch {
			/* use fallback */
		}
		return fallback;
	}
</script>

<svelte:head><title>Edit event | Ligerbots Carpool</title></svelte:head>

<main id="main-content" class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
	<a class="text-sm text-blue-700 hover:underline" href={resolve('/')}>← Back to events</a>
	<IdentityNotice identity={data.identity} />
	{#if data.status === 'error'}
		<div class="mt-6"><ErrorState message={data.message} /></div>
	{:else}
		<div class="mt-3 flex flex-wrap items-end justify-between gap-4">
			<h1 class="text-3xl font-bold">Edit {data.details.event.name}</h1>
			<div class="flex flex-wrap gap-3">
				<a
					class="text-sm font-semibold text-blue-700 hover:underline"
					href={resolve('/events/[eventId]/riders', { eventId: data.details.event.id })}
					>Rider print view</a
				>
				<a
					class="text-sm font-semibold text-blue-700 hover:underline"
					href={resolve('/events/[eventId]/export', { eventId: data.details.event.id })}
					>Download CSV</a
				>
			</div>
		</div>
		<div class="mt-6"><AdminEventForm event={data.details.event} /></div>

		<section class="mt-8" aria-labelledby="trips-heading">
			<div class="flex items-end justify-between gap-4">
				<div>
					<h2 id="trips-heading" class="text-2xl font-semibold">Trips and vehicle assignments</h2>
					<p class="mt-1 text-slate-600">
						Publish trips and assign available vehicles without exposing global controls to drivers.
					</p>
				</div>
			</div>
			<div class="mt-4 space-y-5">
				{#each data.details.trips as trip (trip.id)}
					<div class="rounded-2xl border border-slate-200 bg-white p-5">
						<AdminTripForm eventId={data.details.event.id} {trip} />
						<div class="mt-4 border-t border-slate-200 pt-4">
							<h3 class="font-semibold">Assigned vehicles</h3>
							{#if trip.rides.length === 0}<p class="mt-2 text-sm text-slate-600">
									No vehicles assigned.
								</p>{/if}
							<ul class="mt-2 space-y-2">
								{#each trip.rides as ride (ride.id)}<li
										class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"
									>
										<span
											><strong>{ride.vehicle.name}</strong> · {ride.riders.length}/{ride.vehicle
												.seats} riders</span
										><button
											class="rounded border border-red-300 px-2 py-1 text-red-800"
											type="button"
											onclick={() => unassign(ride.id)}>Unassign</button
										>
									</li>{/each}
							</ul>
							<div class="mt-3 flex flex-wrap items-end gap-2">
								<label class="text-sm font-medium"
									>Assign vehicle<select
										class="ml-2 rounded-lg border border-slate-300 px-2 py-1"
										value={assignmentVehicle[trip.id] ?? ''}
										onchange={(event) => {
											assignmentVehicle[trip.id] = event.currentTarget.value;
										}}
										><option value="">Choose…</option
										>{#each data.vehicles as entry (entry.vehicle.id)}<option
												value={entry.vehicle.id}
												>{entry.vehicle.name} ({entry.vehicle.primaryDriver.displayName})</option
											>{/each}</select
									></label
								><button
									class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
									type="button"
									onclick={() => assign(trip.id)}>Assign</button
								>
							</div>
						</div>
					</div>
				{/each}
				<AdminTripForm eventId={data.details.event.id} />
			</div>
			{#if feedback}<p class="mt-3 text-sm text-slate-700" role="status" aria-live="polite">
					{feedback}
				</p>{/if}
		</section>
	{/if}
</main>
