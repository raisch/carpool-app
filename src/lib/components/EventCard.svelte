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

<article class="legacy-panel flex h-full flex-col">
	<div class="legacy-panel-heading flex items-center justify-between gap-3">
		<h2 class="font-semibold">{event.name}</h2>
		{#if isAdmin}
			<a
				class="text-sm font-semibold text-white underline-offset-2 hover:underline"
				href={resolve('/events/[eventId]/edit', { eventId: event.id })}
				aria-label={`Edit ${event.name}`}>Edit event</a
			>
		{/if}
	</div>
	<div class="legacy-panel-body flex flex-1 flex-col">
		<div class="legacy-meta-grid">
			<div>
				<span class="legacy-meta-label">Dates</span>
				<span class="text-sm font-semibold text-slate-800"
					>{formatDate(event.startDate)} — {formatDate(event.endDate)}</span
				>
			</div>
			<div>
				<span class="legacy-meta-label">Location</span>
				<span class="text-sm font-semibold text-slate-800">{event.location}</span>
			</div>
		</div>
		{#if event.description}
			<p class="mt-3 text-sm leading-6 text-slate-700">{event.description}</p>
		{/if}
		<div class="mt-auto flex flex-wrap items-center gap-2 pt-5">
			<a
				class="legacy-action legacy-action-primary"
				href={resolve('/events/[eventId]', { eventId: event.id })}>View trips</a
			>
			{#if isAdmin}
				<a class="legacy-action" href={resolve('/events/[eventId]/edit', { eventId: event.id })}
					>Manage event</a
				>
			{/if}
		</div>
	</div>
</article>
