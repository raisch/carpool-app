<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const isPrintPreview = $derived(page.url.searchParams.get('print') === '1');
</script>

<svelte:head>
	<title
		>{data.status === 'ready' ? `${data.report.event.name} event report` : 'Event report'}</title
	>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.status === 'error'}
	<main class="report error"><p>{data.message}</p></main>
{:else}
	<main class="report">
		{#if !isPrintPreview}
			<div class="no-print controls">
				<a href={resolve('/events/[eventId]', { eventId: data.report.event.id })}>← Back to event</a
				>
				<button type="button" onclick={() => window.print()}>Print report</button>
			</div>
		{/if}

		<header class="summary">
			<div>
				<p class="eyebrow">Complete event transportation report</p>
				<h1>{data.report.event.name}</h1>
				<p>
					{data.report.event.startDate} — {data.report.event.endDate} · {data.report.event.location}
				</p>
				{#if data.report.event.description}<p>{data.report.event.description}</p>{/if}
			</div>
			<div class="counts" aria-label="Report warnings">
				<strong class={{ warning: data.report.incompleteCount > 0 }}
					>{data.report.incompleteCount} incomplete</strong
				>
				<strong>{data.report.optOutCount} opt-outs</strong>
			</div>
		</header>

		{#if data.report.incompleteCount > 0}
			<div class="alert" role="note">
				<strong>Action required:</strong> highlighted riders have no ride or explicit opt-out for at least
				one direction.
			</div>
		{/if}

		<section aria-labelledby="riders-heading">
			<h2 id="riders-heading">Rider transportation status</h2>
			<table>
				<thead><tr><th>Rider</th><th>Outbound</th><th>Return</th><th>Overall</th></tr></thead>
				<tbody>
					{#each data.report.riders as rider (rider.riderId)}
						<tr class={{ incomplete: rider.incomplete }}>
							<td
								><strong>{rider.riderName}</strong>{#if rider.riderName === rider.riderId}<small>
										({rider.riderId})</small
									>{/if}</td
							>
							<td
								class={{
									attention: rider.outbound === 'incomplete',
									optout: rider.outbound === 'opt_out'
								}}>{rider.outbound.replace('_', ' ')}</td
							>
							<td
								class={{
									attention: rider.return === 'incomplete',
									optout: rider.return === 'opt_out'
								}}>{rider.return.replace('_', ' ')}</td
							>
							<td>{rider.incomplete ? 'Action required' : 'Complete'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section aria-labelledby="rides-heading">
			<h2 id="rides-heading">Trips, vehicles, and seats</h2>
			<table>
				<thead
					><tr
						><th>Direction / departure</th><th>Route</th><th>Vehicle</th><th>Driver</th><th
							>Seats</th
						><th>Riders</th></tr
					></thead
				>
				<tbody>
					{#each data.report.rides as ride (`${ride.direction}-${ride.tripId}-${ride.vehicleName}`)}
						<tr>
							<td><strong>{ride.direction}</strong><br />{ride.departsOn} {ride.departsAt}</td>
							<td>{ride.departsFrom} → {ride.destination}</td>
							<td>{ride.vehicleName}<br /><small>{ride.vehicleType}</small></td>
							<td>{ride.driverName}</td>
							<td
								>{ride.occupiedSeats} / {ride.capacity}<br /><small
									>{ride.remainingSeats} remaining</small
								></td
							>
							<td
								>{ride.riders.length
									? ride.riders.map((rider) => rider.displayName).join(', ')
									: 'None'}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if data.report.rides.length === 0}<p>No vehicle rides are assigned.</p>{/if}
		</section>
	</main>
{/if}

<style>
	:global(body) {
		background: white;
		background-image: none;
		color: #111827;
		font-family: Arial, sans-serif;
	}
	.report {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1rem;
		font-size: 11px;
	}
	.summary {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 2px solid #111827;
		padding-bottom: 0.5rem;
	}
	h1 {
		margin: 0.15rem 0;
		font-size: 20px;
	}
	h2 {
		margin: 0.8rem 0 0.25rem;
		font-size: 14px;
		border-bottom: 1px solid #9ca3af;
		padding-bottom: 0.15rem;
	}
	p {
		margin: 0.2rem 0;
	}
	.eyebrow {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.counts {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		text-align: right;
		white-space: nowrap;
	}
	.warning,
	.attention,
	.optout {
		color: #92400e;
	}
	.optout {
		background: #fee2e2;
		font-weight: 700;
	}
	.alert {
		margin: 0.5rem 0;
		border: 1px solid #d97706;
		background: #fef3c7;
		padding: 0.35rem 0.5rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	th,
	td {
		border: 1px solid #9ca3af;
		padding: 0.25rem 0.35rem;
		text-align: left;
		vertical-align: top;
	}
	th {
		background: #e5e7eb;
		font-weight: 700;
	}
	tr.incomplete {
		background: #fef3c7;
		box-shadow: inset 3px 0 #d97706;
	}
	small {
		color: #4b5563;
	}
	.controls {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.controls a {
		color: #1d4ed8;
	}
	button {
		border: 1px solid #374151;
		background: #111827;
		color: white;
		padding: 0.35rem 0.6rem;
		font-weight: 700;
	}
	@media print {
		.no-print {
			display: none !important;
		}
		.report {
			max-width: none;
			padding: 0;
		}
		section {
			break-inside: avoid;
		}
		thead {
			display: table-header-group;
		}
		.alert,
		tr.incomplete,
		.attention,
		.optout,
		th {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		@page {
			margin: 0.45in;
		}
	}
</style>
