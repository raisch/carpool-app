<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminEventForm from '#lib/components/AdminEventForm.svelte';
	import IdentityNotice from '#lib/components/IdentityNotice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Create event | Ligerbots Carpool</title></svelte:head>

<main id="main-content" class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<a class="text-sm text-blue-700 hover:underline" href={resolve('/')}>← Back to events</a>
	<h1 class="mt-3 text-3xl font-bold">Create event</h1>
	<IdentityNotice identity={data.identity} />
	<div class="mt-6"><AdminEventForm /></div>
</main>
