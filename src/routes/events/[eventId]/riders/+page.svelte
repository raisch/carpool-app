<script lang="ts">
	import { resolve } from '$app/paths';
	import { eventRiderExportRows } from '#lib/domain/export';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const rows = $derived(data.status === 'ready' ? eventRiderExportRows(data.event) : []);
</script>

<svelte:head>
	<title
		>{data.status === 'ready' ? `${data.event.event.name} rider list` : 'Rider list'} | Ligerbots</title
	>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	id="main-content"
	class="print-page mx-auto max-w-6xl px-4 py-8 text-slate-950 sm:px-6 lg:px-8"
>
	{#if data.status === 'error'}
		<ErrorState message={data.message} />
	{:else}
		<div class="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
			<a
				class="text-sm font-medium text-blue-700 hover:underline"
				href={resolve('/events/[eventId]', { eventId: data.event.event.id })}>← Back to event</a
			>
			<div class="flex flex-wrap gap-3">
				<a
					class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
					href={resolve('/events/[eventId]/export', { eventId: data.event.event.id })}
					>Download CSV</a
				>
				<button
					class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
					type="button"
					onclick={() => window.print()}>Print rider list</button
				>
			</div>
		</div>

		<header class="border-b border-slate-300 pb-5">
			<p class="text-sm font-semibold tracking-[0.2em] text-blue-700 uppercase">
				Carpool rider list
			</p>
			<h1 class="mt-2 text-3xl font-bold">{data.event.event.name}</h1>
			<p class="mt-2 text-slate-700">
				{data.event.event.startDate} — {data.event.event.endDate} · {data.event.event.location}
			</p>
		</header>

		{#if rows.length === 0}
			<p class="mt-8 rounded-lg border border-slate-200 p-5">
				No riders are assigned to this event.
			</p>
		{:else}
			<div class="mt-8 overflow-x-auto">
				<table class="w-full border-collapse text-left text-sm">
					<caption class="sr-only">Assigned riders for {data.event.event.name}</caption>
					<thead>
						<tr class="border-b-2 border-slate-400">
							<th class="px-2 py-2 font-semibold">Rider</th>
							<th class="px-2 py-2 font-semibold">Direction</th>
							<th class="px-2 py-2 font-semibold">Departure</th>
							<th class="px-2 py-2 font-semibold">Route</th>
							<th class="px-2 py-2 font-semibold">Vehicle</th>
							<th class="px-2 py-2 font-semibold">Driver</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (`${row.direction}-${row.tripId}-${row.vehicleId}-${row.riderId}`)}
							<tr class="border-b border-slate-200 align-top">
								<td class="px-2 py-2 font-medium">{row.riderName}</td>
								<td class="px-2 py-2 capitalize">{row.direction}</td>
								<td class="px-2 py-2 whitespace-nowrap">{row.departsOn} at {row.departsAt}</td>
								<td class="px-2 py-2">{row.departsFrom} → {row.destination}</td>
								<td class="px-2 py-2">{row.vehicleName} ({row.vehicleType})</td>
								<td class="px-2 py-2">{row.primaryDriverName}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</main>

<style>
	@media print {
		:global(body) {
			background: white;
		}

		:global(nav[aria-label='Carpool navigation']),
		.no-print {
			display: none !important;
		}

		.print-page {
			max-width: none;
			padding: 0;
		}

		:global(a) {
			color: inherit;
			text-decoration: none;
		}
	}
</style>
