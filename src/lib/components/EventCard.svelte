<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EventSummaryDto } from '#lib/domain/types';

	let { event, isAdmin = false }: { event: EventSummaryDto; isAdmin?: boolean } = $props();

	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	function formatDate(value: string): string {
		return dateFormatter.format(new Date(`${value}T00:00:00`));
	}
</script>

<article class="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="flex-1">
		<div class="flex items-start justify-between gap-4">
			<p class="text-sm font-medium tracking-wide text-blue-700 uppercase">
				{formatDate(event.startDate)} — {formatDate(event.endDate)}
			</p>
			{#if isAdmin}
				<a
					href={resolve('/events/[eventId]/edit', { eventId: event.id })}
					aria-label={`Edit ${event.name}`}
					class="shrink-0 rounded border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
					>Edit</a
				>
			{/if}
		</div>
		<h2 class="mt-2 text-2xl font-semibold text-slate-950">{event.name}</h2>
		<p class="mt-2 text-slate-600">{event.location}</p>
		{#if event.description}
			<p class="mt-4 text-slate-700">{event.description}</p>
		{/if}
	</div>
	<a
		href={resolve('/events/[eventId]', { eventId: event.id })}
		class="mt-6 inline-flex w-fit items-center rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
	>
		View transportation options
	</a>
</article>
