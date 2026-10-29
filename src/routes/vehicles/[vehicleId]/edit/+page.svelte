<script lang="ts">
	import { resolve } from '$app/paths';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import RiderManagement from '#lib/components/RiderManagement.svelte';
	import VehicleForm from '#lib/components/VehicleForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const adminFields = $derived(
		data.identity.status === 'configured' && data.identity.currentUser.role === 'admin'
	);
</script>

<main id="main-content" class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<a
		class="text-sm text-blue-700 hover:underline"
		href={resolve('/vehicles/[vehicleId]', {
			vehicleId: data.status === 'ready' ? data.vehicle.vehicle.id : ''
		})}>← Back to vehicle</a
	><IdentityNotice identity={data.identity} />{#if data.status === 'ready'}<h1
			class="mt-3 text-3xl font-bold"
		>
			Edit {data.vehicle.vehicle.name}
		</h1>
		<div class="mt-6">
			<VehicleForm vehicle={data.vehicle} drivers={data.drivers} {adminFields} />
		</div>
		<RiderManagement assignments={data.vehicle.assignments} riders={data.riders} />{:else}<p
			class="mt-6 text-red-800"
			role="alert"
		>
			{data.message}
		</p>{/if}
</main>
