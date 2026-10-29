<script lang="ts">
	import { resolve } from '$app/paths';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Vehicle details | Ligerbots Carpool</title>
</svelte:head>

<main id="main-content" class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<a class="text-sm text-blue-700 hover:underline" href={resolve('/vehicles')}>← Back to vehicles</a
	>
	<IdentityNotice identity={data.identity} />
	{#if data.status === 'error'}
		<div class="mt-6"><ErrorState message={data.message} /></div>
	{:else}
		<div class="mt-3 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold">{data.vehicle.vehicle.name}</h1>
				<p class="mt-2 text-slate-600">
					{data.vehicle.vehicle.vehicleType} · {data.vehicle.vehicle.seats} seats ·
					{data.vehicle.vehicle.status}
				</p>
				<p class="text-slate-600">
					Primary driver: {data.vehicle.vehicle.primaryDriver.displayName}
				</p>
			</div>
			<a
				class="rounded-lg border border-slate-300 px-4 py-2 font-semibold"
				href={resolve('/vehicles/[vehicleId]/edit', { vehicleId: data.vehicle.vehicle.id })}
				>Edit vehicle</a
			>
		</div>

		<section class="mt-8" aria-labelledby="assignments-heading">
			<h2 id="assignments-heading" class="text-2xl font-semibold">Trip assignments and riders</h2>
			{#if data.vehicle.assignments.length === 0}
				<p class="mt-3 text-slate-600">This vehicle is not assigned to a trip.</p>
			{:else}
				<div class="mt-4 space-y-4">
					{#each data.vehicle.assignments as assignment (assignment.tripRideId)}
						<article class="rounded-2xl border border-slate-200 bg-white p-5">
							<h3 class="font-semibold">
								{assignment.trip.direction} · {assignment.trip.destination}
							</h3>
							<p class="mt-1 text-sm text-slate-600">
								{assignment.trip.departsOn} at {assignment.trip.departsAt} from
								{assignment.trip.departsFrom}
							</p>
							<p class="mt-3 text-sm font-medium">
								{assignment.riders.length}/{data.vehicle.vehicle.seats} riders
							</p>
							{#if assignment.riders.length > 0}
								<ul class="mt-2 list-disc pl-5 text-sm text-slate-700">
									{#each assignment.riders as rider (rider.id)}
										<li>{rider.displayName}</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-2 text-sm text-slate-500">No riders assigned.</p>
							{/if}
							<a
								class="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline"
								href={resolve('/vehicles/[vehicleId]/edit', {
									vehicleId: data.vehicle.vehicle.id
								})}>Manage riders</a
							>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>
