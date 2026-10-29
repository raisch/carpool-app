<script lang="ts">
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

<div class="min-h-screen bg-slate-50 text-slate-950">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
			<p class="text-sm font-semibold tracking-[0.2em] text-blue-700 uppercase">Ligerbots</p>
			<h1 class="mt-1 text-3xl font-bold tracking-tight">Carpool events</h1>
			<p class="mt-2 max-w-2xl text-slate-600">
				Find an event and review the available outbound and return transportation.
			</p>
		</div>
	</header>

	<main id="main-content" class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<IdentityNotice identity={data.identity} />
		{#if data.launchStatus === 'invalid'}
			<div
				class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
				role="alert"
			>
				<strong>Carpool sign-in was not completed.</strong>
				Please log into the LigerBots web site first and open Resources / Carpools.
			</div>
		{/if}

		{#if data.identity.status === 'configured'}
			<section class="mt-8" aria-labelledby="events-heading">
				<div class="flex items-end justify-between gap-4">
					<div>
						<h2 id="events-heading" class="text-2xl font-semibold">Upcoming events</h2>
						<p class="mt-1 text-slate-600">Published events with carpool planning available.</p>
					</div>
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
					<div class="mt-6 grid gap-5 md:grid-cols-2">
						{#each data.events as event (event.id)}
							<EventCard {event} isAdmin={data.identity.currentUser.role === 'admin'} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</main>
</div>
