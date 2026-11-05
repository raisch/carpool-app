<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import TransportationStatusForm from '#lib/components/TransportationStatusForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const isAdmin = $derived(
		data.identity.status === 'configured' && data.identity.currentUser.role === 'admin'
	);
</script>

<svelte:head>
	<title>Event transportation | Ligerbots</title>
</svelte:head>

<div class="legacy-page text-slate-950">
	<header class="legacy-page-header">
		<div class="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
			<a class="text-sm font-medium text-blue-700 hover:underline" href={resolve('/')}
				>← All events</a
			>
			<h1 class="mt-3 text-3xl font-bold tracking-tight">Event transportation</h1>
		</div>
	</header>

	<main id="main-content" class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<IdentityNotice identity={data.identity} />

		{#if data.status === 'error'}
			<div class="mt-6"><ErrorState message={data.message} /></div>
		{:else if data.status === 'not-found'}
			<div class="mt-6">
				<EmptyState
					title="Event not found"
					message="This event may be unpublished, archived, or no longer available."
				/>
			</div>
		{:else}
			<section class="legacy-panel" aria-labelledby="event-heading">
				<div class="legacy-panel-heading flex items-center justify-between gap-3">
					<h2 id="event-heading" class="font-semibold">{data.details.event.name}</h2>
					<span class="text-sm text-blue-100">Event details</span>
				</div>
				<div class="legacy-panel-body">
					<div class="legacy-meta-grid">
						<div>
							<span class="legacy-meta-label">Dates</span>
							<span class="text-sm font-semibold text-slate-800"
								>{data.details.event.startDate} — {data.details.event.endDate}</span
							>
						</div>
						<div>
							<span class="legacy-meta-label">Location</span>
							<span class="text-sm font-semibold text-slate-800">{data.details.event.location}</span
							>
						</div>
					</div>
					{#if data.details.event.description}
						<p class="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
							{data.details.event.description}
						</p>
					{/if}
					{#if isAdmin}
						<div
							class="no-print mt-4 flex flex-wrap gap-2"
							aria-label="Administrator event reports"
						>
							<a
								class="legacy-action"
								href={`${resolve('/events/[eventId]/riders', { eventId: data.eventId })}?print=1`}
								target="_blank"
								rel="noreferrer">Rider print view</a
							>
							<a
								class="legacy-action"
								href={resolve('/events/[eventId]/export', { eventId: data.eventId })}
								>Download rider CSV</a
							>
						</div>
					{/if}
				</div>
			</section>

			<TransportationStatusForm
				eventId={data.eventId}
				details={data.details}
				identity={data.identity}
			/>
		{/if}
	</main>
</div>
