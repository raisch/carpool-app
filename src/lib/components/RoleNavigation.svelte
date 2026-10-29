<script lang="ts">
	import { resolve } from '$app/paths';
	import type { IdentityState } from '#lib/domain/types';

	let { identity, simulatorUrl }: { identity: IdentityState; simulatorUrl: string | null } =
		$props();
	const currentUser = $derived(identity.status === 'configured' ? identity.currentUser : null);
</script>

<nav class="border-b border-slate-200 bg-white" aria-label="Carpool navigation">
	<div
		class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm sm:px-6 lg:px-8"
	>
		<a class="font-semibold text-blue-700 hover:underline" href={resolve('/')}>Carpool</a>
		{#if currentUser?.role === 'admin'}
			<a class="text-slate-700 hover:text-blue-700 hover:underline" href={resolve('/events/create')}
				>New event</a
			>
			<a class="text-slate-700 hover:text-blue-700 hover:underline" href={resolve('/vehicles')}
				>Vehicles</a
			>
			<a class="text-slate-700 hover:text-blue-700 hover:underline" href={resolve('/users')}
				>Users</a
			>
		{:else if currentUser?.role === 'driver'}
			<a class="text-slate-700 hover:text-blue-700 hover:underline" href={resolve('/vehicles')}
				>My vehicle</a
			>
		{/if}
		{#if currentUser}
			<div class="ml-auto flex items-center gap-3">
				<span class="text-slate-500">{currentUser.displayName} · {currentUser.role}</span>
				{#if simulatorUrl}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- simulatorUrl is an external site URL -->
					<a
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
						href={simulatorUrl}>Back to simulator</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</div>
		{/if}
	</div>
</nav>
