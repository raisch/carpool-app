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

<label
	class={[
		'block rounded-xl border p-4 transition',
		selected ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white',
		unavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400'
	].join(' ')}
>
	<div class="flex items-start gap-3">
		<input
			type="radio"
			{name}
			value={ride.id}
			checked={selected}
			disabled={unavailable}
			onchange={() => onselect(ride.id)}
			class="mt-1 size-4 accent-blue-700"
		/>
		<span class="min-w-0 flex-1">
			<span class="flex flex-wrap items-center justify-between gap-2">
				<strong class="text-base text-slate-950">{ride.vehicle.name}</strong>
				{#if selected}
					<span class="rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white"
						>Selected</span
					>
				{:else if full}
					<span class="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
						>Full</span
					>
				{/if}
			</span>
			<span class="mt-1 block text-sm text-slate-600">
				{ride.vehicle.vehicleType} · Driver: {ride.vehicle.primaryDriver.displayName}
			</span>
			<span class="mt-2 block text-sm font-medium text-slate-700">{capacityLabel}</span>
			{#if ride.riders.length > 0}
				<span class="mt-2 block text-sm text-slate-600">
					Riders: {ride.riders.map((rider) => rider.displayName).join(', ')}
				</span>
			{:else}
				<span class="mt-2 block text-sm text-slate-500">No riders yet</span>
			{/if}
		</span>
	</div>
</label>
