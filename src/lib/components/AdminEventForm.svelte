<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { EventSummaryDto } from '#lib/domain/types';

	let { event = null }: { event?: EventSummaryDto | null } = $props();

	let draft = $state<
		Partial<
			Pick<
				EventSummaryDto,
				'status' | 'name' | 'description' | 'startDate' | 'endDate' | 'location'
			>
		>
	>({});
	let pending = $state(false);
	let feedback = $state('');
	let error = $state(false);
	const form = $derived({
		status: draft.status ?? event?.status ?? 'draft',
		name: draft.name ?? event?.name ?? '',
		description: draft.description ?? event?.description ?? '',
		startDate: draft.startDate ?? event?.startDate ?? '',
		endDate: draft.endDate ?? event?.endDate ?? '',
		location: draft.location ?? event?.location ?? ''
	});

	async function submit(): Promise<void> {
		pending = true;
		feedback = '';
		error = false;
		try {
			const response = await fetch(
				event ? resolve('/api/events/[eventId]', { eventId: event.id }) : resolve('/api/events'),
				{
					method: event ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({
						status: form.status,
						name: form.name,
						description: form.description || null,
						startDate: form.startDate,
						endDate: form.endDate,
						location: form.location
					})
				}
			);
			const body: unknown = await response.json();
			if (!response.ok) throw new Error(errorMessage(body, 'The event could not be saved.'));
			const saved = body as { data?: EventSummaryDto };
			if (event) {
				feedback = 'Event saved.';
			} else if (saved.data) {
				await goto(resolve('/events/[eventId]/edit', { eventId: saved.data.id }));
			}
		} catch (cause) {
			error = true;
			feedback = cause instanceof Error ? cause.message : 'The event could not be saved.';
		} finally {
			pending = false;
		}
	}

	async function remove(): Promise<void> {
		if (!event || !window.confirm('Delete this event and its empty assignments?')) return;
		pending = true;
		try {
			const response = await fetch(resolve('/api/events/[eventId]', { eventId: event.id }), {
				method: 'DELETE',
				headers: { Accept: 'application/json' }
			});
			if (!response.ok) {
				const body: unknown = await response.json();
				throw new Error(errorMessage(body, 'The event could not be deleted.'));
			}
			await goto(resolve('/'));
		} catch (cause) {
			error = true;
			feedback = cause instanceof Error ? cause.message : 'The event could not be deleted.';
			pending = false;
		}
	}

	function errorMessage(body: unknown, fallback: string): string {
		if (
			typeof body === 'object' &&
			body !== null &&
			'error' in body &&
			typeof body.error === 'object' &&
			body.error !== null &&
			'message' in body.error &&
			typeof body.error.message === 'string'
		)
			return body.error.message;
		return fallback;
	}
</script>

<form
	class="space-y-5 rounded-2xl border border-slate-200 bg-white p-5"
	onsubmit={(event) => {
		event.preventDefault();
		submit();
	}}
>
	<div class="grid gap-5 md:grid-cols-2">
		<label class="block text-sm font-medium text-slate-800"
			>Name<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.name}
				oninput={(event) => (draft.name = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium text-slate-800"
			>Location<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.location}
				oninput={(event) => (draft.location = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium text-slate-800"
			>Start date<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				type="date"
				value={form.startDate}
				oninput={(event) => (draft.startDate = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium text-slate-800"
			>End date<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				type="date"
				value={form.endDate}
				oninput={(event) => (draft.endDate = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium text-slate-800"
			>Status<select
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.status}
				onchange={(event) =>
					(draft.status = event.currentTarget.value as EventSummaryDto['status'])}
				><option value="draft">Draft</option><option value="published">Published</option><option
					value="archived">Archived</option
				></select
			></label
		>
	</div>
	<label class="block text-sm font-medium text-slate-800"
		>Description<textarea
			class="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
			value={form.description}
			oninput={(event) => (draft.description = event.currentTarget.value)}
			maxlength="1024"></textarea></label
	>
	<div class="flex flex-wrap items-center gap-3">
		<button
			class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
			disabled={pending}
			type="submit">{pending ? 'Saving…' : event ? 'Save event' : 'Create event'}</button
		>
		{#if event}<button
				class="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-800"
				disabled={pending}
				type="button"
				onclick={remove}>Delete event</button
			>{/if}
		{#if feedback}<p
				tabindex="-1"
				class={error ? 'text-sm text-red-800' : 'text-sm text-green-800'}
				role={error ? 'alert' : 'status'}
				aria-live="polite"
			>
				{feedback}
			</p>{/if}
	</div>
</form>
