<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AdminVehicleDto, UserProfileDto, VehicleDto } from '#lib/domain/types';

	let {
		vehicle = null,
		drivers = [],
		adminFields = true
	}: {
		vehicle?: AdminVehicleDto | null;
		drivers?: UserProfileDto[];
		adminFields?: boolean;
	} = $props();
	let draft = $state<
		Partial<Pick<VehicleDto, 'status' | 'name' | 'vehicleType' | 'seats'>> & {
			primaryDriverId?: string;
		}
	>({});
	let pending = $state(false);
	let feedback = $state('');
	const form = $derived({
		status: draft.status ?? vehicle?.vehicle.status ?? 'draft',
		name: draft.name ?? vehicle?.vehicle.name ?? '',
		vehicleType: draft.vehicleType ?? vehicle?.vehicle.vehicleType ?? 'Car',
		seats: draft.seats ?? vehicle?.vehicle.seats ?? 1,
		primaryDriverId:
			draft.primaryDriverId ?? vehicle?.vehicle.primaryDriver.id ?? drivers[0]?.id ?? ''
	});

	async function submit(): Promise<void> {
		pending = true;
		feedback = '';
		const response = await fetch(resolve('/api/vehicles'), {
			method: vehicle ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				...(vehicle ? { id: vehicle.vehicle.id } : {}),
				status: form.status,
				name: form.name,
				vehicleType: form.vehicleType,
				seats: Number(form.seats),
				primaryDriverId: form.primaryDriverId
			})
		});
		const body: unknown = await response.json();
		if (!response.ok) feedback = errorMessage(body, 'The vehicle could not be saved.');
		else if (vehicle) feedback = 'Vehicle saved.';
		else {
			const id = (body as { data?: VehicleDto }).data?.id;
			if (id) await goto(resolve('/vehicles/[vehicleId]', { vehicleId: id }));
		}
		pending = false;
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
		<label class="block text-sm font-medium"
			>Name<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.name}
				oninput={(event) => (draft.name = event.currentTarget.value)}
				required
			/></label
		>
		<label class="block text-sm font-medium"
			>Vehicle type<select
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.vehicleType}
				onchange={(event) => (draft.vehicleType = event.currentTarget.value)}
				><option>Car</option><option>Van</option><option>Shuttle</option><option>Bus</option><option
					>Other</option
				></select
			></label
		>
		<label class="block text-sm font-medium"
			>Seats<input
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				type="number"
				min="1"
				step="1"
				value={form.seats}
				oninput={(event) => (draft.seats = Number(event.currentTarget.value))}
				required
			/></label
		>
		<label class="block text-sm font-medium"
			>Primary driver<select
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.primaryDriverId}
				onchange={(event) => (draft.primaryDriverId = event.currentTarget.value)}
				disabled={vehicle !== null || !adminFields}
				>{#each drivers as driver (driver.id)}<option value={driver.id}>{driver.displayName}</option
					>{/each}</select
			></label
		>
		<label class="block text-sm font-medium"
			>Status<select
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
				value={form.status}
				onchange={(event) => (draft.status = event.currentTarget.value as VehicleDto['status'])}
				disabled={!adminFields}
				><option value="draft">Draft</option><option value="published">Published</option><option
					value="archived">Archived</option
				></select
			></label
		>
	</div>
	<div class="flex items-center gap-3">
		<button
			class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
			type="submit"
			disabled={pending || !form.primaryDriverId}
			>{pending ? 'Saving…' : vehicle ? 'Save vehicle' : 'Create vehicle'}</button
		>{#if feedback}<p tabindex="-1" class="text-sm text-slate-700" role="status" aria-live="polite">
				{feedback}
			</p>{/if}
	</div>
</form>
