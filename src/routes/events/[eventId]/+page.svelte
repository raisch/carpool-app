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

<div class="min-h-screen bg-slate-50 text-slate-950">
	<header class="border-b border-slate-200 bg-white">
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
			<section aria-labelledby="event-heading">
				<p class="text-sm font-medium tracking-wide text-blue-700 uppercase">
					{data.details.event.startDate} — {data.details.event.endDate}
				</p>
				<h2 id="event-heading" class="mt-2 text-3xl font-bold">{data.details.event.name}</h2>
				<p class="mt-2 text-slate-600">{data.details.event.location}</p>
				{#if data.details.event.description}
					<p class="mt-4 max-w-3xl text-slate-700">{data.details.event.description}</p>
				{/if}
				{#if isAdmin}
					<div class="no-print mt-5 flex flex-wrap gap-3" aria-label="Administrator event reports">
						<a
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
							href={resolve('/events/[eventId]/riders', { eventId: data.eventId })}
							>Rider print view</a
						>
						<a
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
							href={resolve('/events/[eventId]/export', { eventId: data.eventId })}
							>Download rider CSV</a
						>
					</div>
				{/if}
			</section>

			<TransportationStatusForm
				eventId={data.eventId}
				details={data.details}
				identity={data.identity}
			/>
		{/if}
	</main>
</div>
