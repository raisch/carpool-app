<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type {
		EventDetailsDto,
		IdentityState,
		TransportationDecisionInput
	} from '#lib/domain/types';
	import TripRideCard from './TripRideCard.svelte';

	let {
		eventId,
		details,
		identity
	}: {
		eventId: string;
		details: EventDetailsDto;
		identity: IdentityState;
	} = $props();

	function selectionFor(decision: EventDetailsDto['currentTransportation']['outbound']): string {
		if (!decision) return '';
		return decision.decision === 'opt_out' ? 'opt_out' : (decision.tripRideId ?? '');
	}

	let outboundOverride = $state<string | null>(null);
	let returnOverride = $state<string | null>(null);
	let pending = $state(false);
	let feedback = $state('');
	let feedbackKind = $state<'success' | 'error' | ''>('');
	let savingForNavigation = $state(false);

	const canSubmit = $derived(identity.status === 'configured' && !pending);
	const serverOutboundSelection = $derived(selectionFor(details.currentTransportation.outbound));
	const serverReturnSelection = $derived(selectionFor(details.currentTransportation.return));
	const outboundSelection = $derived(outboundOverride ?? serverOutboundSelection);
	const returnSelection = $derived(returnOverride ?? serverReturnSelection);
	const hasUnsavedChanges = $derived(
		outboundSelection !== serverOutboundSelection || returnSelection !== serverReturnSelection
	);
	const expectedUpdatedAt = $derived(
		[
			details.currentTransportation.outbound?.updatedAt,
			details.currentTransportation.return?.updatedAt
		]
			.filter((value): value is string => value !== undefined)
			.sort()
			.at(-1) ?? null
	);
	function clearFeedback(): void {
		feedback = '';
		feedbackKind = '';
	}

	function chooseOutbound(selection: string): void {
		outboundOverride = selection;
		clearFeedback();
	}

	function chooseReturn(selection: string): void {
		returnOverride = selection;
		clearFeedback();
	}

	function choiceFromSelection(selection: string): TransportationDecisionInput | null {
		if (selection === '') return null;
		return selection === 'opt_out'
			? { decision: 'opt_out', tripRideId: null }
			: { decision: 'ride', tripRideId: selection };
	}

	async function saveChoices(): Promise<boolean> {
		clearFeedback();

		if (identity.status !== 'configured') {
			feedback = 'Transportation saving is unavailable until identity integration is connected.';
			feedbackKind = 'error';
			return false;
		}

		const outbound = choiceFromSelection(outboundSelection);
		const returning = choiceFromSelection(returnSelection);
		if (!outbound || !returning) {
			feedback = 'Choose a ride or opt out for both directions before saving.';
			feedbackKind = 'error';
			return false;
		}

		pending = true;
		try {
			const response = await fetch(resolve('/api/events/[eventId]/transportation', { eventId }), {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ outbound, return: returning, expectedUpdatedAt })
			});
			const body: unknown = await response.json();
			if (!response.ok) {
				const message =
					typeof body === 'object' &&
					body !== null &&
					'error' in body &&
					typeof body.error === 'object' &&
					body.error !== null &&
					'message' in body.error &&
					typeof body.error.message === 'string'
						? body.error.message
						: 'Transportation status could not be saved.';
				feedback = response.status === 409 ? `${message} The event has been refreshed.` : message;
				feedbackKind = 'error';
				if (response.status === 409) {
					outboundOverride = null;
					returnOverride = null;
					await invalidateAll();
				}
				return false;
			}

			outboundOverride = null;
			returnOverride = null;
			feedback = 'Transportation status saved for both directions.';
			feedbackKind = 'success';
			await invalidateAll();
			return true;
		} catch {
			feedback = 'The transportation update could not be completed. Refresh and try again.';
			feedbackKind = 'error';
			return false;
		} finally {
			pending = false;
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		await saveChoices();
	}

	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
			if (!hasUnsavedChanges || savingForNavigation) return;
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	beforeNavigate((navigation) => {
		if (!hasUnsavedChanges || savingForNavigation || navigation.type === 'leave') return;
		if (!navigation.to) return;
		const destination = navigation.to;

		navigation.cancel();
		if (!window.confirm('Save your transportation choices before leaving this page?')) return;

		void (async () => {
			savingForNavigation = true;
			const saved = await saveChoices();
			savingForNavigation = false;
			if (!saved) return;

			if (destination.route === null) {
				window.location.assign(destination.url);
			} else {
				await goto(destination.url);
			}
		})();
	});
</script>

<section class="mt-8" aria-labelledby="transportation-heading">
	<div class="legacy-panel-heading flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="transportation-heading" class="font-semibold">Transportation options</h2>
			<p class="mt-1 text-sm text-blue-100">Choose one ride, or opt out, for each direction.</p>
		</div>
		{#if identity.status !== 'configured'}
			<p class="max-w-sm text-sm text-amber-100">
				Selections can be reviewed here, but saving requires a connected team-member identity.
			</p>
		{/if}
	</div>

	<form class="legacy-panel-body space-y-5" aria-busy={pending} onsubmit={submit}>
		<fieldset class="legacy-trip p-3" disabled={!canSubmit}>
			<legend class="legacy-trip-heading w-full font-semibold text-slate-900"
				>Outbound · To the event</legend
			>
			{#if details.outbound.trip}
				<p class="mt-1 text-sm text-slate-600">
					{details.outbound.trip.departsOn} at {details.outbound.trip.departsAt} ·
					{details.outbound.trip.departsFrom} → {details.outbound.trip.destination}
				</p>
			{:else}
				<p class="mt-1 text-sm text-slate-600">No outbound trip has been configured.</p>
			{/if}

			<div class="mt-3 space-y-3">
				{#if details.outbound.rides.length === 0}
					<p class="border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
						No outbound rides have been configured yet.
					</p>
				{:else}
					{#each details.outbound.rides as ride (ride.id)}
						<TripRideCard
							{ride}
							name="outbound-decision"
							selectedRideId={outboundSelection === 'opt_out' ? null : outboundSelection}
							onselect={chooseOutbound}
							disabled={!canSubmit}
						/>
					{/each}
				{/if}
			</div>
			<label
				class="mt-3 flex cursor-pointer items-center gap-3 border-t border-slate-200 pt-3 text-sm font-medium text-slate-800"
			>
				<input
					type="radio"
					name="outbound-decision"
					value="opt_out"
					checked={outboundSelection === 'opt_out'}
					onchange={() => chooseOutbound('opt_out')}
					class="size-4 accent-blue-700"
				/>
				I do not need outbound transportation
			</label>
		</fieldset>

		<fieldset class="legacy-trip p-3" disabled={!canSubmit}>
			<legend class="legacy-trip-heading w-full font-semibold text-slate-900"
				>Return · From the event</legend
			>
			{#if details.return.trip}
				<p class="mt-1 text-sm text-slate-600">
					{details.return.trip.departsOn} at {details.return.trip.departsAt} ·
					{details.return.trip.departsFrom} → {details.return.trip.destination}
				</p>
			{:else}
				<p class="mt-1 text-sm text-slate-600">No return trip has been configured.</p>
			{/if}

			<div class="mt-3 space-y-3">
				{#if details.return.rides.length === 0}
					<p class="border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
						No return rides have been configured yet.
					</p>
				{:else}
					{#each details.return.rides as ride (ride.id)}
						<TripRideCard
							{ride}
							name="return-decision"
							selectedRideId={returnSelection === 'opt_out' ? null : returnSelection}
							onselect={chooseReturn}
							disabled={!canSubmit}
						/>
					{/each}
				{/if}
			</div>
			<label
				class="mt-3 flex cursor-pointer items-center gap-3 border-t border-slate-200 pt-3 text-sm font-medium text-slate-800"
			>
				<input
					type="radio"
					name="return-decision"
					value="opt_out"
					checked={returnSelection === 'opt_out'}
					onchange={() => chooseReturn('opt_out')}
					class="size-4 accent-blue-700"
				/>
				I do not need return transportation
			</label>
		</fieldset>

		<div>
			<button
				type="submit"
				disabled={!canSubmit}
				class="legacy-action legacy-action-primary disabled:cursor-not-allowed disabled:opacity-60"
			>
				{pending ? 'Saving…' : 'Save transportation choices'}
			</button>
			{#if feedback}
				<p
					tabindex="-1"
					class={feedbackKind === 'error'
						? 'mt-3 text-sm text-red-800'
						: 'mt-3 text-sm text-green-800'}
					role={feedbackKind === 'error' ? 'alert' : 'status'}
					aria-live="polite"
				>
					{feedback}
				</p>
			{/if}
		</div>
	</form>
</section>
