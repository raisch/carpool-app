<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import EventCard from '#lib/components/EventCard.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Carpool events | Ligerbots</title>
	<meta
		name="description"
		content="Find transportation options for upcoming Ligerbots team events."
	/>
</svelte:head>

<div class="legacy-page text-slate-950">
	<header class="legacy-page-header">
		<div class="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p class="text-sm font-semibold tracking-[0.18em] text-blue-700 uppercase">Ligerbots</p>
					<h1 class="mt-1 text-3xl font-bold tracking-tight">Carpool events</h1>
					<p class="mt-2 max-w-2xl text-slate-600">
						Find an event and review the available outbound and return transportation.
					</p>
				</div>
				{#if data.identity.status === 'configured' && data.identity.currentUser.role === 'admin'}
					<div class="flex flex-wrap gap-2" aria-label="Event administration">
						<a class="legacy-action" href={resolve('/vehicles')}>Manage vehicles</a>
						<a class="legacy-action legacy-action-primary" href={resolve('/events/create')}
							>Create event</a
						>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<main id="main-content" class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<IdentityNotice identity={data.identity} />
		{#if data.launchStatus === 'invalid'}
			<div class="legacy-alert mt-4 text-sm" role="alert">
				<strong>Carpool sign-in was not completed.</strong>
				Please log into the LigerBots web site first and open Resources / Carpools.
			</div>
		{/if}

		{#if data.identity.status === 'configured'}
			<section class="mt-8" aria-labelledby="events-heading">
				<div class="legacy-panel-heading">
					<h2 id="events-heading" class="font-semibold">Upcoming carpool events</h2>
					<p class="mt-1 text-sm text-blue-100">
						Published events with carpool planning available.
					</p>
				</div>

				{#if data.status === 'error'}
					<div class="mt-6"><ErrorState message={data.message} /></div>
				{:else if data.events.length === 0}
					<div class="mt-6">
						<EmptyState
							title="No active carpool events"
							message="Published events will appear here when they are available."
						/>
					</div>
				{:else}
					<div class="mt-4 grid gap-4 md:grid-cols-2">
						{#each data.events as event (event.id)}
							<EventCard {event} isAdmin={data.identity.currentUser.role === 'admin'} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</main>
</div>
