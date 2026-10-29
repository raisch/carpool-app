<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AdminTripDto, TripDto } from '#lib/domain/types';

	let { eventId, trip = null }: { eventId: string; trip?: AdminTripDto | null } = $props();
	let draft = $state<Partial<TripDto>>({});
	let pending = $state(false);
	let feedback = $state('');
	const form = $derived({
		direction: draft.direction ?? trip?.direction ?? 'outbound',
		status: draft.status ?? trip?.status ?? 'draft',
		destination: draft.destination ?? trip?.destination ?? '',
		departsFrom: draft.departsFrom ?? trip?.departsFrom ?? '',
		departsOn: draft.departsOn ?? trip?.departsOn ?? '',
		departsAt: draft.departsAt ?? trip?.departsAt ?? '',
		arrivesAt: draft.arrivesAt ?? trip?.arrivesAt ?? ''
	});

	async function submit(): Promise<void> {
		pending = true;
		feedback = '';
		const response = await fetch(resolve('/api/trips'), {
			method: trip ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				...(trip ? { id: trip.id } : {}),
				eventId,
				direction: form.direction,
				status: form.status,
				destination: form.destination,
				departsFrom: form.departsFrom,
				departsOn: form.departsOn,
				departsAt: form.departsAt,
				arrivesAt: form.arrivesAt || null
			})
		});
		const body: unknown = await response.json();
		feedback = response.ok ? 'Trip saved.' : errorMessage(body, 'The trip could not be saved.');
		pending = false;
		if (response.ok) await invalidateAll();
	}

	async function remove(): Promise<void> {
		if (!trip || !window.confirm('Delete this trip and its empty assignments?')) return;
		pending = true;
		const response = await fetch(`${resolve('/api/trips')}?id=${encodeURIComponent(trip.id)}`, {
			method: 'DELETE'
		});
		const body: unknown = response.ok ? null : await response.json();
		feedback = response.ok ? 'Trip deleted.' : errorMessage(body, 'The trip could not be deleted.');
		pending = false;
		if (response.ok) await invalidateAll();
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
	class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
	onsubmit={(event) => {
		event.preventDefault();
		submit();
	}}
>
	<div class="grid gap-4 md:grid-cols-2">
		<label class="block text-sm font-medium"
			>Direction<select
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.direction}
				onchange={(event) => (draft.direction = event.currentTarget.value as TripDto['direction'])}
				disabled={trip !== null}
				><option value="outbound">Outbound</option><option value="return">Return</option></select
			></label
		>
		<label class="block text-sm font-medium"
			>Status<select
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.status}
				onchange={(event) => (draft.status = event.currentTarget.value as TripDto['status'])}
				><option value="draft">Draft</option><option value="published">Published</option><option
					value="archived">Archived</option
				></select
			></label
		>
		<label class="block text-sm font-medium"
			>Destination<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.destination}
				oninput={(event) => (draft.destination = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium"
			>Departure location<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.departsFrom}
				oninput={(event) => (draft.departsFrom = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium"
			>Departure date<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				type="date"
				value={form.departsOn}
				oninput={(event) => (draft.departsOn = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium"
			>Departure time<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				type="time"
				value={form.departsAt}
				oninput={(event) => (draft.departsAt = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium"
			>Arrival time<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				type="time"
				value={form.arrivesAt}
				oninput={(event) => (draft.arrivesAt = event.currentTarget.value)}
			/></label
		>
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<button
			class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
			type="submit"
			disabled={pending}>{pending ? 'Saving…' : trip ? 'Save trip' : 'Create trip'}</button
		>{#if trip}<button
				class="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-800"
				type="button"
				disabled={pending}
				onclick={remove}>Delete trip</button
			>{/if}{#if feedback}<p
				tabindex="-1"
				class="text-sm text-slate-700"
				role="status"
				aria-live="polite"
			>
				{feedback}
			</p>{/if}
	</div>
</form>
