<script lang="ts">
	import type { TripRideDto } from '#lib/domain/types';

	let {
		ride,
		name,
		selectedRideId,
		disabled = false,
		onselect
	}: {
		ride: TripRideDto;
		name: string;
		selectedRideId: string | null;
		disabled?: boolean;
		onselect: (rideId: string) => void;
	} = $props();

	const selected = $derived(selectedRideId === ride.id);
	const full = $derived(ride.remainingSeats === 0 && !selected);
	const unavailable = $derived(disabled || full);
	const capacityLabel = $derived(
		`${ride.occupiedSeats} of ${ride.vehicle.seats} seats occupied · ${ride.remainingSeats} remaining`
	);
</script>

<article
	class={[
		'legacy-ride',
		selected ? 'legacy-ride-selected' : '',
		unavailable ? 'opacity-60' : ''
	].join(' ')}
>
	<div class="flex items-start gap-3 p-3">
		<input
			id={`ride-${ride.id}`}
			type="radio"
			{name}
			value={ride.id}
			checked={selected}
			disabled={unavailable}
			onchange={() => onselect(ride.id)}
			class="mt-1 size-4 accent-blue-700"
		/>
		<label class="min-w-0 flex-1" for={`ride-${ride.id}`}>
			<span class="flex flex-wrap items-center justify-between gap-2">
				<strong class="text-base text-slate-950">{ride.vehicle.name}</strong>
				{#if selected}
					<span class="rounded bg-blue-700 px-2 py-1 text-xs font-semibold text-white"
						>Selected</span
					>
				{:else if full}
					<span class="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
						>Full</span
					>
				{/if}
			</span>
			<span class="mt-1 block text-sm text-slate-600">{capacityLabel}</span>
		</label>
	</div>
	<details class="border-t border-slate-200 px-3 py-2 text-sm">
		<summary class="cursor-pointer font-semibold text-blue-700">View ride details</summary>
		<dl class="mt-3 grid gap-2 sm:grid-cols-2">
			<div>
				<dt class="legacy-meta-label">Vehicle</dt>
				<dd>{ride.vehicle.vehicleType}</dd>
			</div>
			<div>
				<dt class="legacy-meta-label">Driver</dt>
				<dd>{ride.vehicle.primaryDriver.displayName}</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="legacy-meta-label">Riders</dt>
				<dd>
					{ride.riders.length > 0
						? ride.riders.map((rider) => rider.displayName).join(', ')
						: 'No riders yet'}
				</dd>
			</div>
		</dl>
	</details>
</article>
