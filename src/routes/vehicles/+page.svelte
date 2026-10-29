<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const isAdmin = $derived(
		data.identity.status === 'configured' && data.identity.currentUser.role === 'admin'
	);
</script>

<svelte:head><title>Vehicles | Ligerbots Carpool</title></svelte:head>

<main id="main-content" class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
	<a class="text-sm text-blue-700 hover:underline" href={resolve('/')}>← Back to events</a>
	<div class="mt-3 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">{isAdmin ? 'Vehicle management' : 'My vehicle'}</h1>
			<p class="mt-2 text-slate-600">
				{isAdmin
					? 'Manage fleet ownership, lifecycle, and trip assignments.'
					: 'Manage the vehicle assigned to you and its riders.'}
			</p>
		</div>
		{#if isAdmin}<a
				class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
				href={resolve('/vehicles/create')}>Create vehicle</a
			>{/if}
	</div>
	<IdentityNotice identity={data.identity} />
	{#if data.status === 'error'}
		<div class="mt-6"><ErrorState message={data.message} /></div>
	{:else if data.vehicles.length === 0}
		<div class="mt-6">
			<EmptyState
				title="No vehicles available"
				message={isAdmin
					? 'Create a vehicle to begin assigning transportation.'
					: 'No vehicle is assigned to your identity.'}
			/>
		</div>
	{:else}
		<div class="mt-6 grid gap-5 md:grid-cols-2">
			{#each data.vehicles as entry (entry.vehicle.id)}<article
					class="rounded-2xl border border-slate-200 bg-white p-5"
				>
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 class="text-xl font-semibold">{entry.vehicle.name}</h2>
							<p class="mt-1 text-sm text-slate-600">
								{entry.vehicle.vehicleType} · {entry.vehicle.seats} seats · {entry.vehicle.status}
							</p>
							<p class="mt-1 text-sm text-slate-600">
								Primary driver: {entry.vehicle.primaryDriver.displayName}
							</p>
						</div>
						<a
							class="text-sm font-semibold text-blue-700 hover:underline"
							href={resolve('/vehicles/[vehicleId]', { vehicleId: entry.vehicle.id })}>Details</a
						>
					</div>
					<p class="mt-4 text-sm text-slate-700">
						{entry.assignments.length} trip assignment{entry.assignments.length === 1 ? '' : 's'} · {entry.assignments.reduce(
							(total, assignment) => total + assignment.riders.length,
							0
						)} riders
					</p>
				</article>{/each}
		</div>
	{/if}
</main>
