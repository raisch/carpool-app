<script lang="ts">
	import { resolve } from '$app/paths';
	import type { IdentityState } from '#lib/domain/types';

	let { identity, simulatorUrl }: { identity: IdentityState; simulatorUrl: string | null } =
		$props();
	const currentUser = $derived(identity.status === 'configured' ? identity.currentUser : null);
	let menuOpen = $state(false);
</script>

<nav class="site-navigation" aria-label="Carpool navigation">
	<div class="site-navigation-inner">
		<a class="site-navigation-brand" href={resolve('/')}>Carpool</a>
		<button
			class="site-navigation-toggle"
			type="button"
			aria-controls="carpool-navigation-links"
			aria-expanded={menuOpen}
			aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
			onclick={() => (menuOpen = !menuOpen)}
		>
			<span aria-hidden="true">☰</span>
			<span>{menuOpen ? 'Close' : 'Menu'}</span>
		</button>
		<div
			id="carpool-navigation-links"
			class={['site-navigation-links', menuOpen && 'site-navigation-links-open']}
		>
			{#if currentUser?.role === 'admin'}
				<a class="site-navigation-link" href={resolve('/events/create')}>New event</a>
				<a class="site-navigation-link" href={resolve('/vehicles')}>Vehicles</a>
				<a class="site-navigation-link" href={resolve('/users')}>Users</a>
			{:else if currentUser?.role === 'driver'}
				<a class="site-navigation-link" href={resolve('/vehicles')}>My vehicle</a>
			{/if}
			{#if currentUser}
				<div class="site-navigation-user">
					<span>{currentUser.displayName} · {currentUser.role}</span>
					{#if simulatorUrl}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- simulatorUrl is an external site URL -->
						<a class="site-navigation-return" href={simulatorUrl}>Return to Ligerbots</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			{/if}
		</div>
	</div>
</nav>
