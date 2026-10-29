<script lang="ts">
	import { resolve } from '$app/paths';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import VehicleForm from '#lib/components/VehicleForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main id="main-content" class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<a class="text-sm text-blue-700 hover:underline" href={resolve('/vehicles')}>← Back to vehicles</a
	>
	<h1 class="mt-3 text-3xl font-bold">Create vehicle</h1>
	<IdentityNotice identity={data.identity} />{#if data.status === 'ready'}<div class="mt-6">
			<VehicleForm drivers={data.drivers} />
		</div>{:else}<p class="mt-6 text-red-800" role="alert">{data.message}</p>{/if}
</main>
